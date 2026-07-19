import { useTimerStore } from "@/features/timer/use-timer-store";
import { useUIStore } from "@/features/ui/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  BellOff,
  Coffee,
  Maximize2,
  Minimize2,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
} from "lucide-react";

interface IdleActionsProps {
  phase: "work" | "short_break" | "long_break";
  secondsRemaining: number;
  durations: { work: number; short: number; long: number };
  isFullscreenFocus: boolean;
  breakReminderActive: boolean;
  canReviewPreviousFocus?: boolean;
  onReviewPreviousFocus?: () => void;
}

export function IdleActions({
  phase,
  secondsRemaining,
  durations,
  isFullscreenFocus,
  breakReminderActive,
  canReviewPreviousFocus = false,
  onReviewPreviousFocus,
}: IdleActionsProps) {
  const start = useTimerStore((s) => s.start);
  const reset = useTimerStore((s) => s.reset);
  const adjustDuration = useTimerStore((s) => s.adjustDuration);
  const endWithoutBreak = useTimerStore((s) => s.endWithoutBreak);
  const acknowledgeBreakReminder = useTimerStore(
    (s) => s.acknowledgeBreakReminder,
  );
  const setFullscreenFocus = useUIStore((s) => s.setFullscreenFocus);

  const isModified =
    (phase === "work" && secondsRemaining !== durations.work) ||
    (phase === "short_break" && secondsRemaining !== durations.short) ||
    (phase === "long_break" && secondsRemaining !== durations.long);
  const startLabel = phase === "work" ? "开始专注" : "开始休息";
  const isBreakReminderActive = phase === "work" && breakReminderActive;
  const isBreakReady = phase !== "work" && !breakReminderActive;

  const handleStart = async () => {
    const result = await start(undefined, {
      source: "timer_button",
      enterFullscreen: true,
    });
    if (result === "started") {
      setFullscreenFocus(true);
    }
  };

  return (
    <>
      {isBreakReminderActive && (
        <div
          role="status"
          aria-live="polite"
          className="mb-1 basis-full text-center"
        >
          <p className="text-sm font-semibold text-sahara-text">休息结束</p>
          <p className="mt-1 text-xs text-sahara-text-secondary">
            准备好就开始下一轮专注
          </p>
        </div>
      )}

      <Button
        variant="solid"
        intent="sahara"
        size="lg"
        shape="rounded-full"
        onClick={() => void handleStart()}
        className="gap-1.5 md:gap-2 text-xs md:text-xs px-6 md:px-8 py-3 md:py-3.5"
      >
        {isBreakReady ? (
          <Coffee className="size-3.5 md:w-4 md:h-4" />
        ) : (
          <Play className="size-3.5 md:w-4 md:h-4 fill-current ml-0.5" />
        )}
        {startLabel}
      </Button>

      {isBreakReminderActive && (
        <Button
          variant="outline"
          intent="slate"
          size="sm"
          shape="rounded-full"
          onClick={() => acknowledgeBreakReminder("remind_later")}
          className="min-h-11 gap-1.5 px-4 text-xs"
        >
          <BellOff className="size-4" />
          稍后开始
        </Button>
      )}

      {canReviewPreviousFocus && onReviewPreviousFocus && (
        <Button
          variant="outline"
          intent="default"
          size="sm"
          shape="rounded-full"
          onClick={onReviewPreviousFocus}
          className="gap-1 md:gap-1.5 text-[10px]"
        >
          <NotebookPen className="size-3.5 md:size-4" />
          快速复盘
        </Button>
      )}

      {isBreakReady && (
        <>
          <div className="h-6 md:h-8 w-px bg-sahara-border/20 mx-0.5 md:mx-1 hidden sm:block" />
          <Button
            variant="outline"
            intent="sahara"
            size="sm"
            shape="rounded-full"
            onClick={() => adjustDuration(5)}
            className="gap-1 md:gap-1.5 text-[10px]"
          >
            <Plus className="size-3.5 md:w-4 md:h-4" />
            延长 5 分钟
          </Button>
          <Button
            variant="outline"
            intent="slate"
            size="sm"
            shape="rounded-full"
            onClick={() => void endWithoutBreak()}
            className="gap-1 md:gap-1.5 text-[10px]"
          >
            <SkipForward className="size-3.5 md:w-4 md:h-4" />
            跳过休息
          </Button>
        </>
      )}

      {isModified && (
        <>
          <div className="h-6 md:h-8 w-px bg-sahara-border/20 mx-0.5 md:mx-1 hidden sm:block" />
          <Button
            variant="outline"
            size="icon"
            intent="default"
            shape="rounded-full"
            aria-label="重置"
            onClick={reset}
            className="border-sahara-border/30 text-sahara-text-secondary p-2 md:p-3"
          >
            <RotateCcw className="size-3.5 md:w-4 md:h-4" />
          </Button>
        </>
      )}

      <div className="h-6 md:h-8 w-px bg-sahara-border/20 mx-0.5 md:mx-1 hidden sm:block" />

      <FullscreenButton
        isFullscreenFocus={isFullscreenFocus}
        onClick={() => setFullscreenFocus(!isFullscreenFocus)}
      />
    </>
  );
}

export function FullscreenButton({
  isFullscreenFocus,
  onClick,
  size = "md",
}: {
  isFullscreenFocus: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      intent="default"
      shape="rounded-full"
      onClick={onClick}
      aria-label={isFullscreenFocus ? "退出专注模式" : "进入专注模式"}
      title={isFullscreenFocus ? "退出专注模式" : "进入专注模式"}
      className={
        size === "sm"
          ? "border-sahara-border/30 text-sahara-text-secondary hover:border-sahara-primary/40 hover:text-sahara-primary"
          : "border-sahara-border/30 text-sahara-text-secondary hover:border-sahara-primary/40 hover:text-sahara-primary p-2 md:p-3"
      }
    >
      {isFullscreenFocus ? (
        <Minimize2 className="size-3.5" />
      ) : (
        <Maximize2 className="size-3.5" />
      )}
    </Button>
  );
}
