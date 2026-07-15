import type { TimerPhase } from "@/features/timer/timer-types";
import { sendNotification } from "@/lib/notifications";

interface PhaseCompletionDiagnosticContext {
  sessionId?: number | null;
  deadlineLagMs?: number | null;
}

function getPhaseLabel(phase: TimerPhase): string {
  if (phase === "work") return "专注";
  if (phase === "short_break") return "短休息";
  return "长休息";
}

export function notifyPhaseComplete(
  phase: TimerPhase,
  durationMin: number,
  context: PhaseCompletionDiagnosticContext = {},
) {
  const phaseLabel = getPhaseLabel(phase);
  const isWorkPhase = phase === "work";

  sendNotification(
    isWorkPhase ? "focus-complete" : "break-over",
    `${durationMin} 分钟${phaseLabel}已完成。`,
    {
      trigger: "timer_natural_completion",
      sessionId: context.sessionId,
      phase,
      deadlineLagMs: context.deadlineLagMs,
    },
  );
}

export function notifySessionComplete() {
  sendNotification(
    "session-complete",
    "做得好！这次专注已经记录下来。",
    { trigger: "session_complete" },
  );
}

export function notifySkipped(phase: TimerPhase, sessionId?: number | null) {
  sendNotification(
    phase === "work" ? ("session-complete" as const) : ("break-over" as const),
    `${getPhaseLabel(phase)}已结束。`,
    {
      trigger: "timer_skipped_at_completion",
      sessionId,
      phase,
    },
  );
}
