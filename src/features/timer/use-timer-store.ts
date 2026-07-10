import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
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
import { playFocusMusic, stopFocusMusic } from "@/features/timer/focus-music";
import {
  invokeTimerCancelDeadline,
  invokeTimerScheduleDeadline,
  isTauri,
} from "@/lib/tauri";
import {
  playBreakOverSound,
  prepareNotificationAudio,
  stopBreakOverSound,
} from "@/lib/notifications";

interface TimerStore {
  phase: TimerPhase;
  status: TimerStatus;
  secondsRemaining: number;
  totalSeconds: number;
  completedPomos: number;
  activeTaskId: number | null;
  currentSessionId: number | null;
  currentSessionTaskId: number | null;
  selectedCategory: Category | null;
  durations: TimerDurations;
  deadlineAtMs: number | null;
  pendingFocusReview: PendingFocusReview | null;
  breakReminderActive: boolean;

  start: (duration?: number) => void;
  pause: () => void;
  resume: () => void;
  syncWithClock: () => void;
  skip: () => Promise<void>;
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
  submitPendingFocusReview: (mood?: string, notes?: string) => Promise<void>;
  dismissPendingFocusReview: () => void;
  acknowledgeBreakReminder: () => void;
  addFiveMinutes: () => void;
  endWithoutBreak: () => Promise<void>;
}

interface PendingFocusReview {
  sessionId: number;
  durationSec: number;
  ready: boolean;
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
  | "currentSessionTaskId"
  | "selectedCategory"
  | "durations"
  | "deadlineAtMs"
  | "pendingFocusReview"
  | "breakReminderActive"
> & {
  savedAt: number;
};

const TIMER_STORAGE_KEY = "time-butler:timer-state:v1";
const TIMER_DEADLINE_REACHED_EVENT = "timer:deadline-reached";

const engine = new TimerEngine();
let settleInFlight = false;
let nativeDeadlineListenerStarted = false;
let clockSyncListenersInstalled = false;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function computeRemainingFromDeadline(deadlineAtMs: number): number {
  return Math.max(0, Math.ceil((deadlineAtMs - Date.now()) / 1000));
}

function getAccurateSecondsRemaining(
  state: Pick<TimerStore, "status" | "secondsRemaining" | "deadlineAtMs">,
): number {
  if (state.status !== "running" || !state.deadlineAtMs) {
    return state.secondsRemaining;
  }

  return computeRemainingFromDeadline(state.deadlineAtMs);
}

function getElapsedSeconds(
  state: Pick<
    TimerStore,
    "totalSeconds" | "status" | "secondsRemaining" | "deadlineAtMs"
  >,
): number {
  const remaining = getAccurateSecondsRemaining(state);
  return Math.min(state.totalSeconds, Math.max(0, state.totalSeconds - remaining));
}

function getDeadlineFromSaved(saved: PersistedTimerState): number {
  if (saved.deadlineAtMs) return saved.deadlineAtMs;
  return saved.savedAt + saved.secondsRemaining * 1000;
}

function scheduleNativeDeadline(deadlineAtMs: number | null): void {
  if (!deadlineAtMs || !isTauri()) return;
  invokeTimerScheduleDeadline(deadlineAtMs).catch((err) => {
    console.warn("[TimerStore] Failed to schedule native timer deadline:", err);
  });
}

function cancelNativeDeadline(): void {
  if (!isTauri()) return;
  invokeTimerCancelDeadline().catch((err) => {
    console.warn("[TimerStore] Failed to cancel native timer deadline:", err);
  });
}

function loadPersistedTimerState(): Partial<TimerStore> {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as PersistedTimerState;

    if (saved.status === "running") {
      const deadlineAtMs = getDeadlineFromSaved(saved);
      const remaining = computeRemainingFromDeadline(deadlineAtMs);

      return {
        ...saved,
        secondsRemaining: remaining,
        deadlineAtMs,
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
        currentSessionTaskId: null,
        deadlineAtMs: null,
      };
    }

    return { ...saved, deadlineAtMs: null };
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
    currentSessionTaskId: state.currentSessionTaskId,
    selectedCategory: state.selectedCategory,
    durations: state.durations,
    deadlineAtMs: state.deadlineAtMs,
    pendingFocusReview: state.pendingFocusReview,
    breakReminderActive: state.breakReminderActive,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("[TimerStore] Failed to persist timer state:", err);
  }
}

function stopFocusMusicForActiveWork(
  state: Pick<TimerStore, "phase" | "status" | "currentSessionId">,
): void {
  if (state.phase === "work" && (state.status !== "idle" || state.currentSessionId)) {
    void stopFocusMusic();
  }
}

export const useTimerStore = create<TimerStore>((set, get) => {
  const persistedTimerState = loadPersistedTimerState();

  function acknowledgeBreakReminder() {
    if (!get().breakReminderActive) return;
    stopBreakOverSound();
    set({ breakReminderActive: false });
  }

  async function settleCompletedPhase() {
    if (settleInFlight) return;

    const state = get();
    if (state.status !== "running") return;

    settleInFlight = true;
    const {
      currentSessionId,
      currentSessionTaskId,
      activeTaskId,
      phase,
      totalSeconds,
      completedPomos,
      durations,
    } = state;
    try {
      const durationMin = Math.round(state.totalSeconds / 60);
      notifyPhaseComplete(state.phase, durationMin);

      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);

      if (currentSessionId) {
        const completionTaskId = phase === "work"
          ? currentSessionTaskId ?? activeTaskId
          : null;
        if (phase === "work") {
          await SessionService.updateAttribution(
            currentSessionId,
            completionTaskId,
            state.selectedCategory?.id,
            state.selectedCategory?.name,
          );
        }
        await SessionService.finish(currentSessionId, totalSeconds, undefined, undefined, true);
        await recordPomoCompletion(phase, completionTaskId);
      }

      const newPomos = phase === "work" ? completedPomos + 1 : completedPomos;
      const next = getNextPhase(phase, newPomos, durations);
      const settings = useSettingsStore.getState().settings;
      const pendingFocusReview =
        phase === "work" && currentSessionId
          ? { sessionId: currentSessionId, durationSec: totalSeconds, ready: false }
          : phase !== "work" && state.pendingFocusReview
            ? { ...state.pendingFocusReview, ready: true }
            : state.pendingFocusReview;

      set({
        phase: next.phase,
        status: "idle",
        secondsRemaining: next.duration,
        totalSeconds: next.duration,
        completedPomos: newPomos,
        currentSessionId: null,
        currentSessionTaskId: null,
        deadlineAtMs: null,
        pendingFocusReview,
        breakReminderActive: phase !== "work",
      });

      if (phase === "work" && settings.autoStartBreaks) {
        void get().start(next.duration);
      }
    } finally {
      settleInFlight = false;
    }
  }

  function onTimerDone() {
    void settleCompletedPhase();
  }

  engine.setCallbacks({
    onTick: (remaining) => {
      if (remaining <= 0) {
        set({ secondsRemaining: 0 });
        void settleCompletedPhase();
        return;
      }

      set({ secondsRemaining: remaining });
    },
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
    currentSessionTaskId: null,
    selectedCategory: null,
    deadlineAtMs: null,
    pendingFocusReview: null,
    breakReminderActive: false,
    durations: {
      work: DEFAULT_WORK_SEC,
      short: DEFAULT_SHORT_BREAK_SEC,
      long: DEFAULT_LONG_BREAK_SEC,
    },
    ...persistedTimerState,

    start: async (duration?: number) => {
      const state = get();
      void prepareNotificationAudio();
      if (state.breakReminderActive) acknowledgeBreakReminder();

      const secs = duration ?? getPhaseDuration(state.phase, state.durations);

      let resolvedPhase = state.phase;
      if (resolvedPhase === "short_break" || resolvedPhase === "long_break") {
        resolvedPhase = determineBreakPhase(secs, state.durations);
      }

      const sessionTaskId = resolvedPhase === "work" ? state.activeTaskId : null;
      const sessionCategory = resolvedPhase === "work" ? state.selectedCategory : null;

      const sessionId = await SessionService.start(
        sessionTaskId,
        resolvedPhase,
        sessionCategory?.id,
        sessionCategory?.name,
      );

      const deadlineAtMs = Date.now() + secs * 1000;
      engine.start(secs, deadlineAtMs);
      scheduleNativeDeadline(deadlineAtMs);

      set({
        phase: resolvedPhase,
        status: "running",
        secondsRemaining: secs,
        totalSeconds: secs,
        currentSessionId: sessionId,
        currentSessionTaskId: sessionTaskId,
        deadlineAtMs,
        breakReminderActive: false,
      });

      if (resolvedPhase === "work") {
        void playFocusMusic();
      }
    },

    pause: () => {
      const state = get();
      const secondsRemaining = getAccurateSecondsRemaining(state);
      engine.pause();
      cancelNativeDeadline();
      set({ status: "paused", secondsRemaining, deadlineAtMs: null });
    },

    resume: () => {
      const state = get();
      void prepareNotificationAudio();
      const secondsRemaining = Math.max(0, state.secondsRemaining);

      if (secondsRemaining <= 0) {
        set({ status: "running", secondsRemaining: 0 });
        void settleCompletedPhase();
        return;
      }

      const deadlineAtMs = Date.now() + secondsRemaining * 1000;
      if (engine.isRunning()) {
        engine.resume(secondsRemaining, deadlineAtMs);
      } else {
        engine.start(secondsRemaining, deadlineAtMs);
      }
      scheduleNativeDeadline(deadlineAtMs);
      set({ status: "running", secondsRemaining, deadlineAtMs });
    },

    syncWithClock: () => {
      const state = get();
      if (state.status !== "running") return;

      const secondsRemaining = getAccurateSecondsRemaining(state);
      if (secondsRemaining <= 0) {
        set({ secondsRemaining: 0 });
        void settleCompletedPhase();
        return;
      }

      if (secondsRemaining !== state.secondsRemaining) {
        set({ secondsRemaining });
      }
    },

    skip: async () => {
      const state = get();
      const {
        phase,
        totalSeconds,
        currentSessionId,
        currentSessionTaskId,
        activeTaskId,
        completedPomos,
      } = state;

      const secondsRemaining = getAccurateSecondsRemaining(state);
      const completed = secondsRemaining <= 0;
      const elapsed = Math.max(0, totalSeconds - secondsRemaining);

      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);

      if (currentSessionId) {
        const completionTaskId = phase === "work"
          ? currentSessionTaskId ?? activeTaskId
          : null;
        if (phase === "work") {
          await SessionService.updateAttribution(
            currentSessionId,
            completionTaskId,
            state.selectedCategory?.id,
            state.selectedCategory?.name,
          );
        }
        await SessionService.finish(
          currentSessionId,
          elapsed,
          undefined,
          undefined,
          completed,
        );
      } else {
        await SessionService.recordSkip(
          currentSessionTaskId ?? activeTaskId,
          phase,
          elapsed,
          completed,
        );
      }

      if (completed) {
        const completionTaskId = phase === "work"
          ? currentSessionTaskId ?? activeTaskId
          : null;
        await recordPomoCompletion(phase, completionTaskId);
        notifySkipped(phase);
      }

      const newPomos = phase === "work" && completed ? completedPomos + 1 : completedPomos;
      const next = getNextPhase(phase, newPomos, state.durations);

      set({
        phase: next.phase,
        status: phase === "work" && completed ? "running" : "idle",
        secondsRemaining: next.duration,
        totalSeconds: next.duration,
        completedPomos: newPomos,
        currentSessionId: null,
        currentSessionTaskId: null,
        deadlineAtMs: null,
      });

      if (phase === "work" && completed) {
        get().start(next.duration);
      }
    },

    reset: () => {
      const state = get();
      acknowledgeBreakReminder();
      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);
      const duration = getPhaseDuration(state.phase, state.durations);
      set({
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        deadlineAtMs: null,
        breakReminderActive: false,
        currentSessionId: null,
        currentSessionTaskId: null,
      });
    },

    setPhase: (phase: TimerPhase) => {
      const state = get();
      acknowledgeBreakReminder();
      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);
      const duration = getPhaseDuration(phase, state.durations);
      set({
        phase,
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        deadlineAtMs: null,
        breakReminderActive: false,
        currentSessionId: null,
        currentSessionTaskId: null,
      });
    },

    setActiveTask: async (taskId: number | null) => {
      const sessionState = get();
      const shouldRetargetCurrentSession =
        sessionState.phase === "work" &&
        sessionState.status !== "idle" &&
        Boolean(sessionState.currentSessionId);

      set({
        activeTaskId: taskId,
        ...(shouldRetargetCurrentSession && { currentSessionTaskId: taskId }),
      });

      let selectedCategory: Category | null = null;
      if (taskId) {
        try {
          const tasks = await getTasks();
          const task = tasks.find((t) => t.id === taskId);
          if (task?.category_id) {
            const category = await getCategory(task.category_id);
            selectedCategory = category || null;
          }
        } catch (err) {
          console.error("[TimerStore] Failed to load category for task:", taskId, err);
        }
      }

      if (shouldRetargetCurrentSession && sessionState.currentSessionId) {
        try {
          await SessionService.updateAttribution(
            sessionState.currentSessionId,
            taskId,
            selectedCategory?.id,
            selectedCategory?.name,
          );
        } catch (err) {
          console.error("[TimerStore] Failed to update session task:", err);
        }
      }

      set({
        selectedCategory,
        ...(shouldRetargetCurrentSession && { currentSessionTaskId: taskId }),
      });
    },

    setDurations: (work: number, short: number, long: number) => {
      const durations = { work, short, long };
      const { phase, status } = get();
      if (status === "idle") {
        const dur = getPhaseDuration(phase, durations);
        set({
          durations,
          secondsRemaining: dur,
          totalSeconds: dur,
          deadlineAtMs: null,
        });
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
      set({
        durations: nextDurations,
        secondsRemaining: nextDuration,
        totalSeconds: nextDuration,
        deadlineAtMs: null,
      });
    },

    adjustDuration: (minutes: number) => {
      const { status, phase, durations } = get();
      const key = getPhaseDurationKey(phase);
      const deltaSec = minutes * 60;

      if (status === "idle") {
        const currentDuration = durations[key];
        const newDuration = Math.max(60, currentDuration + deltaSec);
        const newDurations = { ...durations, [key]: newDuration };
        set({
          durations: newDurations,
          secondsRemaining: newDuration,
          totalSeconds: newDuration,
          deadlineAtMs: null,
        });
      } else {
        const state = get();
        const currentRemaining = getAccurateSecondsRemaining(state);
        const newTotal = Math.max(60, state.totalSeconds + deltaSec);
        const newRemaining = Math.max(0, currentRemaining + deltaSec);
        const deadlineAtMs =
          status === "running" && newRemaining > 0
            ? Date.now() + newRemaining * 1000
            : null;

        set({ totalSeconds: newTotal, secondsRemaining: newRemaining, deadlineAtMs });
        if (status === "running") {
          engine.addTime(deltaSec);
          if (newRemaining <= 0) {
            void settleCompletedPhase();
          } else {
            scheduleNativeDeadline(deadlineAtMs);
          }
        }
      }
    },

    finishSession: async (mood?: string, notes?: string) => {
      const state = get();
      const { currentSessionId } = state;
      acknowledgeBreakReminder();
      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);

      if (currentSessionId) {
        const elapsed = getElapsedSeconds(state);
        await SessionService.finish(currentSessionId, elapsed, mood, notes, false);
      }

      const duration = getPhaseDuration("work", state.durations);
      set({
        status: "idle",
        phase: "work",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
        currentSessionTaskId: null,
        completedPomos: state.completedPomos,
        deadlineAtMs: null,
        pendingFocusReview: state.pendingFocusReview,
        breakReminderActive: false,
      });
    },

    abandonSession: async () => {
      const state = get();
      acknowledgeBreakReminder();
      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);

      if (state.currentSessionId) {
        await SessionService.abandon(state.currentSessionId);
      }

      const duration = getPhaseDuration(state.phase, state.durations);
      set({
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
        currentSessionTaskId: null,
        deadlineAtMs: null,
        breakReminderActive: false,
      });
    },

    setSelectedCategory: (category: Category | null) => {
      set({ selectedCategory: category });
    },

    confirmStartNextPhase: async (mood?: string, notes?: string) => {
      const state = get();
      const {
        currentSessionId,
        currentSessionTaskId,
        activeTaskId,
        phase,
        totalSeconds,
      } = state;
      acknowledgeBreakReminder();
      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);

      if (currentSessionId) {
        const completionTaskId = phase === "work"
          ? currentSessionTaskId ?? activeTaskId
          : null;
        if (phase === "work") {
          await SessionService.updateAttribution(
            currentSessionId,
            completionTaskId,
            state.selectedCategory?.id,
            state.selectedCategory?.name,
          );
        }
        await SessionService.finish(currentSessionId, totalSeconds, mood, notes, true);
        await recordPomoCompletion(phase, completionTaskId, notes);
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
        currentSessionTaskId: null,
        deadlineAtMs: null,
        breakReminderActive: false,
      });

      get().start(next.duration);
    },

    submitPendingFocusReview: async (mood?: string, notes?: string) => {
      const pendingFocusReview = get().pendingFocusReview;
      if (!pendingFocusReview) return;

      await SessionService.updateReflection(
        pendingFocusReview.sessionId,
        mood,
        notes,
      );
      set({ pendingFocusReview: null });
    },

    dismissPendingFocusReview: () => {
      set({ pendingFocusReview: null });
    },

    acknowledgeBreakReminder,

    addFiveMinutes: () => {
      const addedSec = 5 * 60;
      const state = get();
      const secondsRemaining = getAccurateSecondsRemaining(state) + addedSec;
      const deadlineAtMs =
        state.status === "running" ? Date.now() + secondsRemaining * 1000 : null;

      engine.addTime(addedSec);
      if (deadlineAtMs) scheduleNativeDeadline(deadlineAtMs);
      set({
        totalSeconds: state.totalSeconds + addedSec,
        secondsRemaining,
        deadlineAtMs,
      });
    },

    endWithoutBreak: async () => {
      const state = get();
      const {
        currentSessionId,
        currentSessionTaskId,
        activeTaskId,
        phase,
        totalSeconds,
      } = state;
      acknowledgeBreakReminder();
      engine.terminate();
      cancelNativeDeadline();
      stopFocusMusicForActiveWork(state);

      if (currentSessionId) {
        const completionTaskId = phase === "work"
          ? currentSessionTaskId ?? activeTaskId
          : null;
        if (phase === "work") {
          await SessionService.updateAttribution(
            currentSessionId,
            completionTaskId,
            state.selectedCategory?.id,
            state.selectedCategory?.name,
          );
        }
        await SessionService.finish(currentSessionId, totalSeconds, undefined, undefined, true);
        await recordPomoCompletion(phase, completionTaskId);
      }

      const pendingFocusReview =
        phase !== "work" && state.pendingFocusReview
          ? { ...state.pendingFocusReview, ready: true }
          : state.pendingFocusReview;
      const duration = getPhaseDuration("work", state.durations);
      set({
        phase: "work",
        status: "idle",
        secondsRemaining: duration,
        totalSeconds: duration,
        currentSessionId: null,
        currentSessionTaskId: null,
        completedPomos: get().completedPomos + (phase === "work" ? 1 : 0),
        deadlineAtMs: null,
        pendingFocusReview,
        breakReminderActive: false,
      });
    },
  };
});

function startNativeDeadlineListener(): void {
  if (nativeDeadlineListenerStarted || !isTauri()) return;

  nativeDeadlineListenerStarted = true;
  listen<{ token: number; deadlineAtMs: number }>(
    TIMER_DEADLINE_REACHED_EVENT,
    () => {
      useTimerStore.getState().syncWithClock();
    },
  ).catch((err) => {
    nativeDeadlineListenerStarted = false;
    console.warn("[TimerStore] Failed to listen for native timer deadline:", err);
  });
}

function installClockSyncListeners(): void {
  if (clockSyncListenersInstalled || typeof window === "undefined") return;

  clockSyncListenersInstalled = true;
  const sync = () => {
    useTimerStore.getState().syncWithClock();
    playBreakOverReminderIfNeeded();
  };

  window.addEventListener("focus", sync);
  window.addEventListener("online", sync);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sync();
    });
  }
}

function playBreakOverReminderIfNeeded(): void {
  const state = useTimerStore.getState();
  if (!state.breakReminderActive) return;

  const { soundEnabled } = useSettingsStore.getState().settings;
  if (soundEnabled) void playBreakOverSound();
}

useTimerStore.subscribe((state) => persistTimerState(state));

queueMicrotask(() => {
  startNativeDeadlineListener();
  installClockSyncListeners();

  const state = useTimerStore.getState();
  if (state.status === "running") {
    const secondsRemaining = getAccurateSecondsRemaining(state);
    const deadlineAtMs = state.deadlineAtMs ?? Date.now() + secondsRemaining * 1000;

    if (secondsRemaining <= 0) {
      useTimerStore.setState({ secondsRemaining: 0, deadlineAtMs });
      useTimerStore.getState().syncWithClock();
      return;
    }

    useTimerStore.setState({ secondsRemaining, deadlineAtMs });
    engine.start(secondsRemaining, deadlineAtMs);
    scheduleNativeDeadline(deadlineAtMs);
  } else if ((state.status as string) === "focus_complete") {
    const duration = getPhaseDuration(state.phase, state.durations);
    useTimerStore.setState({
      status: "idle",
      secondsRemaining: duration,
      totalSeconds: duration,
      currentSessionId: null,
      currentSessionTaskId: null,
      deadlineAtMs: null,
    });
  }

  playBreakOverReminderIfNeeded();
});
