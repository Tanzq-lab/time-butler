import { create } from "zustand";
import type { TimerPhase, TimerStatus } from "@/features/timer/timer-types";
import { TimerEngine } from "@/features/timer/timer-engine";
import { SessionService } from "@/features/timer/session-service";
import {
  DEFAULT_WORK_SEC,
  DEFAULT_SHORT_BREAK_SEC,
  DEFAULT_LONG_BREAK_SEC,
} from "@/lib/constants";
import { getTasks, getCategory } from "@/lib/db";
import type { Category } from "@/lib/db";
import {
  getPhaseDuration,
  getPhaseDurationKey,
  determineBreakPhase,
  getNextPhase,
  type TimerDurations,
} from "@/features/timer/timer-helpers";
import { recordPomoCompletion } from "@/features/timer/pomo-tracker";
import {
  notifyPhaseComplete,
  notifySkipped,
} from "@/features/timer/timer-notifications";
import { useSettingsStore } from "@/features/settings/use-settings-store";

interface TimerStore {
  phase: TimerPhase;
  status: TimerStatus;
  secondsRemaining: number;
  totalSeconds: number;
  completedPomos: number;
  activeTaskId: number | null;
  currentSessionId: number | null;
  selectedCategory: Category | null;
  durations: TimerDurations;

  start: (duration?: number) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  reset: () => void;
  setPhase: (phase: TimerPhase) => void;
  setActiveTask: (taskId: number | null) => Promise<void>;
  setDurations: (work: number, short: number, long: number) => void;
  setDurationForCurrentPhase: (seconds: number) => void;
  adjustDuration: (minutes: number) => void;
  finishSession: (mood?: string, notes?: string) => Promise<void>;
  abandonSession: () => Promise<void>;
  setSelectedCategory: (category: Category | null) => void;
  confirmStartNextPhase: (mood?: string, notes?: string) => Promise<void>;
  addFiveMinutes: () => void;
  endWithoutBreak: () => Promise<void>;
}

type PersistedTimerState = Pick<
  TimerStore,
  | "phase"
  | "status"
  | "secondsRemaining"
  | "totalSeconds"
  | "completedPomos"
  | "activeTaskId"
  | "currentSessionId"
  | "selectedCategory"
  | "durations"
> & {
  savedAt: number;
};

const TIMER_STORAGE_KEY = "time-butler:timer-state:v1";

const engine = new TimerEngine();

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadPersistedTimerState(): Partial<TimerStore> {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as PersistedTimerState;
    const elapsed = Math.max(0, Math.floor((Date.now() - saved.savedAt) / 1000));

    if (saved.status === "running") {
      const remaining = saved.secondsRemaining - elapsed;
      if (remaining <= 0) {
        const completedPomos =
          saved.phase === "work" ? saved.completedPomos + 1 : saved.completedPomos;
        const next = getNextPhase(saved.phase, completedPomos, saved.durations);
        return {
          ...saved,
          phase: next.phase,
          status: "idle",
          secondsRemaining: next.duration,
          totalSeconds: next.duration,
          completedPomos,
          currentSessionId: null,
        };
      }

      return {
        ...saved,
        secondsRemaining: remaining,
      };
    }

    if ((saved.status as string) === "focus_complete") {
      const duration = getPhaseDuration(saved.phase, saved.durations);
      return {
        ...saved,
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
      };
    }

    return saved;
  } catch (err) {
    console.warn("[TimerStore] Failed to restore timer state:", err);
    return {};
  }
}

function persistTimerState(state: TimerStore): void {
  if (!canUseStorage()) return;

  const snapshot: PersistedTimerState = {
    phase: state.phase,
    status: state.status,
    secondsRemaining: state.secondsRemaining,
    totalSeconds: state.totalSeconds,
    completedPomos: state.completedPomos,
    activeTaskId: state.activeTaskId,
    currentSessionId: state.currentSessionId,
    selectedCategory: state.selectedCategory,
    durations: state.durations,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("[TimerStore] Failed to persist timer state:", err);
  }
}

export const useTimerStore = create<TimerStore>((set, get) => {
  const persistedTimerState = loadPersistedTimerState();

  async function settleCompletedPhase() {
    const state = get();
    const {
      currentSessionId,
      activeTaskId,
      phase,
      totalSeconds,
      completedPomos,
      durations,
    } = state;
    const durationMin = Math.round(state.totalSeconds / 60);
    notifyPhaseComplete(state.phase, durationMin);

    engine.terminate();

    if (currentSessionId) {
      await SessionService.finish(currentSessionId, totalSeconds, undefined, undefined, true);
      recordPomoCompletion(phase, activeTaskId);
    }

    const newPomos = phase === "work" ? completedPomos + 1 : completedPomos;
    const next = getNextPhase(phase, newPomos, durations);
    const settings = useSettingsStore.getState().settings;

    set({
      phase: next.phase,
      status: "idle",
      secondsRemaining: next.duration,
      totalSeconds: next.duration,
      completedPomos: newPomos,
      currentSessionId: null,
    });

    if (phase === "work" && settings.autoStartBreaks) {
      void get().start(next.duration);
    }
  }

  function onTimerDone() {
    void settleCompletedPhase();
  }

  engine.setCallbacks({
    onTick: (remaining) => set({ secondsRemaining: remaining }),
    onDone: onTimerDone,
  });

  return {
    phase: "work",
    status: "idle",
    secondsRemaining: DEFAULT_WORK_SEC,
    totalSeconds: DEFAULT_WORK_SEC,
    completedPomos: 0,
    activeTaskId: null,
    currentSessionId: null,
    selectedCategory: null,
    durations: {
      work: DEFAULT_WORK_SEC,
      short: DEFAULT_SHORT_BREAK_SEC,
      long: DEFAULT_LONG_BREAK_SEC,
    },
    ...persistedTimerState,

    start: async (duration?: number) => {
      const state = get();
      const secs = duration ?? getPhaseDuration(state.phase, state.durations);

      let resolvedPhase = state.phase;
      if (resolvedPhase === "short_break" || resolvedPhase === "long_break") {
        resolvedPhase = determineBreakPhase(secs, state.durations);
      }

      const sessionId = await SessionService.start(
        state.activeTaskId,
        resolvedPhase,
        state.selectedCategory?.id,
        state.selectedCategory?.name,
      );

      engine.start(secs);

      set({
        phase: resolvedPhase,
        status: "running",
        secondsRemaining: secs,
        totalSeconds: secs,
        currentSessionId: sessionId,
      });
    },

    pause: () => {
      engine.pause();
      set({ status: "paused" });
    },

    resume: () => {
      engine.resume();
      set({ status: "running" });
    },

    skip: () => {
      const state = get();
      const { phase, secondsRemaining, totalSeconds, activeTaskId, completedPomos } = state;

      const completed = secondsRemaining <= 0;
      const elapsed = Math.max(0, totalSeconds - secondsRemaining);
      SessionService.recordSkip(activeTaskId, phase, elapsed, completed);

      if (completed) {
        recordPomoCompletion(phase, activeTaskId);
        notifySkipped(phase);
      }

      engine.terminate();

      const newPomos = phase === "work" && completed ? completedPomos + 1 : completedPomos;
      const next = getNextPhase(phase, newPomos, state.durations);

      set({
        phase: next.phase,
        status: phase === "work" && completed ? "running" : "idle",
        secondsRemaining: next.duration,
        totalSeconds: next.duration,
        completedPomos: newPomos,
      });

      if (phase === "work" && completed) {
        get().start(next.duration);
      }
    },

    reset: () => {
      engine.terminate();
      const duration = getPhaseDuration(get().phase, get().durations);
      set({ status: "idle", secondsRemaining: duration, totalSeconds: duration });
    },

    setPhase: (phase: TimerPhase) => {
      engine.terminate();
      const duration = getPhaseDuration(phase, get().durations);
      set({ phase, status: "idle", secondsRemaining: duration, totalSeconds: duration });
    },

    setActiveTask: async (taskId: number | null) => {
      set({ activeTaskId: taskId });
      if (taskId) {
        try {
          const tasks = await getTasks();
          const task = tasks.find((t) => t.id === taskId);
          if (task?.category_id) {
            const category = await getCategory(task.category_id);
            set({ selectedCategory: category || null });
          } else {
            set({ selectedCategory: null });
          }
        } catch (err) {
          console.error("[TimerStore] Failed to load category for task:", taskId, err);
        }
      } else {
        set({ selectedCategory: null });
      }
    },

    setDurations: (work: number, short: number, long: number) => {
      const durations = { work, short, long };
      const { phase, status } = get();
      if (status === "idle") {
        const dur = getPhaseDuration(phase, durations);
        set({ durations, secondsRemaining: dur, totalSeconds: dur });
      } else {
        set({ durations });
      }
    },

    setDurationForCurrentPhase: (seconds: number) => {
      const { status, phase, durations } = get();
      if (status !== "idle") return;
      const nextDuration = Math.max(1, Math.floor(seconds));
      const key = getPhaseDurationKey(phase);
      const nextDurations = { ...durations, [key]: nextDuration };
      set({ durations: nextDurations, secondsRemaining: nextDuration, totalSeconds: nextDuration });
    },

    adjustDuration: (minutes: number) => {
      const { status, phase, durations } = get();
      const key = getPhaseDurationKey(phase);
      const deltaSec = minutes * 60;

      if (status === "idle") {
        const currentDuration = durations[key];
        const newDuration = Math.max(60, currentDuration + deltaSec);
        const newDurations = { ...durations, [key]: newDuration };
        set({ durations: newDurations, secondsRemaining: newDuration, totalSeconds: newDuration });
      } else {
        set((s) => {
          const newTotal = Math.max(60, s.totalSeconds + deltaSec);
          const newRemaining = Math.max(0, s.secondsRemaining + deltaSec);
          return { totalSeconds: newTotal, secondsRemaining: newRemaining };
        });
        if (status === "running") {
          engine.addTime(deltaSec);
        }
      }
    },

    finishSession: async (mood?: string, notes?: string) => {
      const state = get();
      const { currentSessionId, totalSeconds, secondsRemaining } = state;
      engine.terminate();

      if (currentSessionId) {
        const elapsed = Math.max(0, totalSeconds - secondsRemaining);
        await SessionService.finish(currentSessionId, elapsed, mood, notes, false);
      }

      const duration = getPhaseDuration("work", state.durations);
      set({
        status: "idle",
        phase: "work",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
        completedPomos: state.completedPomos,
      });
    },

    abandonSession: async () => {
      const state = get();
      engine.terminate();

      if (state.currentSessionId) {
        await SessionService.abandon(state.currentSessionId);
      }

      const duration = getPhaseDuration(state.phase, state.durations);
      set({
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
      });
    },

    setSelectedCategory: (category: Category | null) => {
      set({ selectedCategory: category });
    },

    confirmStartNextPhase: async (mood?: string, notes?: string) => {
      const state = get();
      const { currentSessionId, activeTaskId, phase, totalSeconds } = state;
      engine.terminate();

      if (currentSessionId) {
        await SessionService.finish(currentSessionId, totalSeconds, mood, notes, true);
        recordPomoCompletion(phase, activeTaskId, notes);
      }

      const newPomos = phase === "work" ? state.completedPomos + 1 : state.completedPomos;
      const next = getNextPhase(state.phase, newPomos, state.durations);

      set({
        phase: next.phase,
        status: "idle",
        secondsRemaining: next.duration,
        totalSeconds: next.duration,
        completedPomos: newPomos,
        currentSessionId: null,
      });

      get().start(next.duration);
    },

    addFiveMinutes: () => {
      const addedSec = 5 * 60;
      engine.addTime(addedSec);
      set((s) => ({
        totalSeconds: s.totalSeconds + addedSec,
        secondsRemaining: s.secondsRemaining + addedSec,
      }));
    },

    endWithoutBreak: async () => {
      const state = get();
      const { currentSessionId, activeTaskId, phase, totalSeconds } = state;
      engine.terminate();

      if (currentSessionId) {
        await SessionService.finish(currentSessionId, totalSeconds, undefined, undefined, true);
        recordPomoCompletion(phase, activeTaskId);
      }

      const duration = getPhaseDuration("work", state.durations);
      set({
        phase: "work",
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
        completedPomos: get().completedPomos + (phase === "work" ? 1 : 0),
      });
    },
  };
});

useTimerStore.subscribe((state) => persistTimerState(state));

queueMicrotask(() => {
  const state = useTimerStore.getState();
  if (state.status === "running") {
    engine.start(state.secondsRemaining);
  } else if ((state.status as string) === "focus_complete") {
    const duration = getPhaseDuration(state.phase, state.durations);
    useTimerStore.setState({
      status: "idle",
      secondsRemaining: duration,
      totalSeconds: duration,
      currentSessionId: null,
    });
  }
});
