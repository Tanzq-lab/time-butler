import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { TimerDisplay } from "@/components/base/timer-display";
import { IntentionSelector } from "@/components/intention-selector";
import { TaskSelector } from "@/components/task-selector";
import { Button } from "@/components/ui/button";
import {
  FinishSessionModal,
} from "@/components/base/finish-session-modal";
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

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishModalMode, setFinishModalMode] = useState<
    "manual" | "pending-review"
  >("manual");

  useEffect(() => {
    if (!pendingFocusReview?.ready) return;
    if (breakReminderActive) return;
    setFinishModalMode("pending-review");
    setShowFinishModal(true);
  }, [
    breakReminderActive,
    pendingFocusReview?.ready,
    pendingFocusReview?.sessionId,
  ]);

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
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
      className="flex flex-col items-center gap-5 md:gap-8 w-full"
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
            className="flex flex-col items-center gap-4 md:gap-5 w-full overflow-hidden"
          >
            {/* Top Controls */}
            <div className="flex items-center gap-3">
              <div className="flex bg-sahara-card p-1 rounded-full border border-sahara-border/20">
                <Button
                  variant="ghost"
                  size="sm"
                  intent="default"
                  shape="rounded-full"
                  active={isFocus}
                  onClick={() => setPhase("work")}
                  disabled={status !== "idle"}
                  className="px-3 sm:px-4 md:px-6 py-2 text-[10px] sm:text-xs font-bold tracking-wider"
                >
                  专注
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  intent="default"
                  shape="rounded-full"
                  active={isBreak}
                  onClick={() => setPhase(detectedBreakPhase)}
                  disabled={status !== "idle"}
                  className="px-3 sm:px-4 md:px-6 py-2 text-[10px] sm:text-xs font-bold tracking-wider"
                >
                  休息
                </Button>
              </div>
              <div className="w-px h-6 bg-sahara-border/20" />
              <PresetSelector />
            </div>

            {/* Task & Intention Selectors */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <TaskSelector disabled={status !== "idle"} />
              <IntentionSelector
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
                disabled={status !== "idle"}
              />
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
        />
      </m.div>

      {/* Duration Adjuster with Time Range */}
      <m.div
        layout="position"
        className="flex items-center gap-2 md:gap-3"
      >
        <Button
          variant="outline"
          size="icon"
          intent="default"
          shape="rounded-full"
          onClick={() => adjustDuration(-5)}
          className="border-sahara-border/30 text-sahara-text-secondary hover:border-sahara-primary/40 hover:text-sahara-primary shrink-0"
        >
          <Minus className="size-3 md:w-3.5 md:h-3.5" />
        </Button>

        <div className="inline-flex items-center gap-1.5 md:gap-2.5 px-2.5 sm:px-4 py-1.5 md:py-2 rounded-full border border-sahara-border/30 bg-sahara-surface shadow-sm">
          <span className="text-xs md:text-sm font-semibold text-sahara-text tabular-nums tracking-wide">
            {startTimeAmPm}
          </span>
          <ArrowRight className="size-2.5 md:w-3.5 md:h-3.5 text-sahara-text-muted" />
          <span className="text-xs md:text-sm font-semibold text-sahara-text tabular-nums tracking-wide">
            {endTimeAmPm}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          intent="default"
          shape="rounded-full"
          onClick={() => adjustDuration(5)}
          className="border-sahara-border/30 text-sahara-text-secondary hover:border-sahara-primary/40 hover:text-sahara-primary shrink-0"
        >
          <Plus className="size-3 md:w-3.5 md:h-3.5" />
        </Button>
      </m.div>

      {/* Action Buttons */}
      <m.div
        layout="position"
        className="flex items-center gap-2 md:gap-4 flex-wrap justify-center max-w-lg md:max-w-none"
      >
        {status === "idle" ? (
          <IdleActions
            phase={phase}
            secondsRemaining={secondsRemaining}
            durations={durations}
            isFullscreenFocus={isFullscreenFocus}
            breakReminderActive={breakReminderActive}
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
    </m.div>
  );
}
