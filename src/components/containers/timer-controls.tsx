import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { TimerDisplay } from "@/components/base/timer-display";
import { IntentionSelector } from "@/components/intention-selector";
import { TaskSelector } from "@/components/task-selector";
import { Button } from "@/components/ui/button";
import {
  FinishSessionModal,
} from "@/components/base/finish-session-modal";
import { TaskNoteModal } from "@/components/base/task-note-modal";
import {
  Plus,
  Minus,
  ArrowRight,
} from "lucide-react";
import { PresetSelector } from "@/components/base/preset-selector";
import { useTimerSelectors } from "@/components/timer/use-timer-selectors";
import { FullscreenTaskLabel } from "@/components/timer/fullscreen-task-label";
import { IdleActions } from "@/components/timer/idle-actions";
import { RunningActions } from "@/components/timer/running-actions";
import type { SessionMood } from "@/features/timer/timer-types";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

export function TimerControls() {
  const {
    timerStyle,
    phase,
    status,
    secondsRemaining,
    totalSeconds,
    durations,
    selectedCategory,
    durationMinutes,
    detectedBreakPhase,
    isFocus,
    isBreak,
    isFullscreenFocus,
    startTimeAmPm,
    endTimeAmPm,
  } = useTimerSelectors();

  const setPhase = useTimerStore((s) => s.setPhase);
  const adjustDuration = useTimerStore((s) => s.adjustDuration);
  const finishSession = useTimerStore((s) => s.finishSession);
  const abandonSession = useTimerStore((s) => s.abandonSession);
  const pendingFocusReview = useTimerStore((s) => s.pendingFocusReview);
  const submitPendingFocusReview = useTimerStore(
    (s) => s.submitPendingFocusReview,
  );
  const dismissPendingFocusReview = useTimerStore(
    (s) => s.dismissPendingFocusReview,
  );
  const setSelectedCategory = useTimerStore((s) => s.setSelectedCategory);
  const setDurationForCurrentPhase = useTimerStore(
    (s) => s.setDurationForCurrentPhase,
  );
  const breakReminderActive = useTimerStore((s) => s.breakReminderActive);
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const appendTaskNote = useTaskStore((s) => s.appendTaskNote);
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const taskPomoProgress = activeTask
    ? getTaskPomoProgressVisual(
        activeTask.completed_pomos,
        activeTask.estimated_pomos,
      )
    : null;

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showTaskNoteModal, setShowTaskNoteModal] = useState(false);
  const [finishModalMode, setFinishModalMode] = useState<
    "manual" | "pending-review"
  >("manual");

  const handleOpenPendingReview = () => {
    if (!pendingFocusReview?.ready) return;
    setFinishModalMode("pending-review");
    setShowFinishModal(true);
  };

  const handleFinishWithReflection = async (data: {
    mood: SessionMood;
    notes: string;
  }) => {
    if (finishModalMode === "pending-review") {
      await submitPendingFocusReview(data.mood, data.notes);
    } else {
      await finishSession(data.mood, data.notes);
    }
    setShowFinishModal(false);
    setFinishModalMode("manual");
  };

  const handleCloseFinishModal = () => {
    if (finishModalMode === "pending-review") {
      dismissPendingFocusReview();
    }
    setShowFinishModal(false);
    setFinishModalMode("manual");
  };

  const finishModalDurationMinutes =
    finishModalMode === "pending-review" && pendingFocusReview
      ? Math.round(pendingFocusReview.durationSec / 60)
      : durationMinutes;

  return (
    <m.div
      layout="position"
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex w-full flex-col items-center gap-5 md:gap-7"
    >
      {/* Task & Category label in fullscreen */}
      {isFullscreenFocus && <FullscreenTaskLabel />}

      {/* Top Controls Group */}
      <AnimatePresence>
        {!isFullscreenFocus && (
          <m.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="flex w-full flex-col items-center gap-3 overflow-hidden"
          >
            {/* Top Controls */}
            <div className="flex w-full max-w-md flex-col items-center gap-1.5 rounded-[10px] border border-sahara-border bg-sahara-card p-1.5 sm:w-auto sm:max-w-none sm:flex-row sm:gap-2">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-md bg-sahara-surface p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    intent="default"
                    active={isFocus}
                    onClick={() => setPhase("work")}
                    disabled={status !== "idle"}
                    className="h-7 rounded-md px-3 text-xs font-medium"
                  >
                    专注
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    intent="default"
                    active={isBreak}
                    onClick={() => setPhase(detectedBreakPhase)}
                    disabled={status !== "idle"}
                    className="h-7 rounded-md px-3 text-xs font-medium"
                  >
                    休息
                  </Button>
                </div>
                <div className="h-5 w-px bg-sahara-border" />
                <PresetSelector />
              </div>
              <div className="hidden h-5 w-px bg-sahara-border sm:block" />
              <div className="flex min-w-0 max-w-full items-center justify-center gap-1.5">
                <TaskSelector disabled={status !== "idle"} />
                <IntentionSelector
                  selectedCategory={selectedCategory}
                  onSelect={setSelectedCategory}
                  disabled={status !== "idle"}
                />
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Timer Display */}
      <m.div layout="position">
        <TimerDisplay
          secondsRemaining={secondsRemaining}
          totalSeconds={totalSeconds}
          phase={phase}
          editable={status === "idle"}
          onDurationChange={setDurationForCurrentPhase}
          style={timerStyle}
          taskPomoProgress={taskPomoProgress}
        />
      </m.div>

      {/* Duration Adjuster with Time Range */}
      <m.div
        layout="position"
        className="flex items-center gap-2"
      >
        <Button
          variant="outline"
          size="icon"
          intent="default"
          onClick={() => adjustDuration(-5)}
          aria-label="减少 5 分钟"
          className="shrink-0 border-sahara-border text-sahara-text-secondary hover:text-sahara-text"
        >
          <Minus className="size-3 md:w-3.5 md:h-3.5" />
        </Button>

        <div className="inline-flex items-center gap-2 rounded-md border border-sahara-border bg-sahara-surface px-3 py-1.5 font-mono">
          <span className="text-xs font-medium tabular-nums text-sahara-text">
            {startTimeAmPm}
          </span>
          <ArrowRight className="size-2.5 md:w-3.5 md:h-3.5 text-sahara-text-muted" />
          <span className="text-xs font-medium tabular-nums text-sahara-text">
            {endTimeAmPm}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          intent="default"
          onClick={() => adjustDuration(5)}
          aria-label="增加 5 分钟"
          className="shrink-0 border-sahara-border text-sahara-text-secondary hover:text-sahara-text"
        >
          <Plus className="size-3 md:w-3.5 md:h-3.5" />
        </Button>
      </m.div>

      {/* Action Buttons */}
      <m.div
        layout="position"
        className="flex max-w-lg flex-wrap items-center justify-center gap-2 md:max-w-none"
      >
        {status === "idle" ? (
          <IdleActions
            phase={phase}
            secondsRemaining={secondsRemaining}
            durations={durations}
            isFullscreenFocus={isFullscreenFocus}
            breakReminderActive={breakReminderActive}
            canReviewPreviousFocus={
              Boolean(pendingFocusReview?.ready) && !breakReminderActive
            }
            onReviewPreviousFocus={handleOpenPendingReview}
          />
        ) : (
          <RunningActions
            status={status}
            isFullscreenFocus={isFullscreenFocus}
            onFinish={() => {
              setFinishModalMode("manual");
              setShowFinishModal(true);
            }}
            onAbandon={() => abandonSession()}
            onRecord={() => setShowTaskNoteModal(true)}
            recordDisabled={!activeTask}
          />
        )}
      </m.div>

      <FinishSessionModal
        open={showFinishModal}
        onClose={handleCloseFinishModal}
        onSubmit={handleFinishWithReflection}
        category={selectedCategory}
        durationMinutes={finishModalDurationMinutes}
      />
      <TaskNoteModal
        open={showTaskNoteModal}
        task={activeTask ?? null}
        onClose={() => setShowTaskNoteModal(false)}
        onSubmit={(content) =>
          activeTask
            ? appendTaskNote(activeTask.id, content, "timer")
            : false
        }
      />
    </m.div>
  );
}
