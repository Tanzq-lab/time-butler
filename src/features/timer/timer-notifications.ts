import type { TimerPhase } from "@/features/timer/timer-types";
import { sendNotification } from "@/lib/notifications";

function getPhaseLabel(phase: TimerPhase): string {
  if (phase === "work") return "专注";
  if (phase === "short_break") return "短休息";
  return "长休息";
}

export function notifyPhaseComplete(
  phase: TimerPhase,
  durationMin: number,
) {
  const phaseLabel = getPhaseLabel(phase);
  const isWorkPhase = phase === "work";

  sendNotification(
    isWorkPhase ? "focus-complete" : "break-over",
    `${durationMin} 分钟${phaseLabel}已完成。`,
  );
}

export function notifySessionComplete() {
  sendNotification(
    "session-complete",
    "做得好！这次专注已经记录下来。",
  );
}

export function notifySkipped(phase: TimerPhase) {
  sendNotification(
    phase === "work" ? ("session-complete" as const) : ("break-over" as const),
    `${getPhaseLabel(phase)}已结束。`,
  );
}
