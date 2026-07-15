import type { TimerPhase } from "@/features/timer/timer-types";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { creditSessionPomo, recordAppEvent } from "@/lib/db";

export async function recordPomoCompletion(
  phase: TimerPhase,
  sessionId: number | null,
  taskId: number | null,
  review?: string,
): Promise<boolean> {
  if (phase !== "work" || !sessionId || !taskId) return false;

  const credited = await creditSessionPomo(sessionId);
  if (!credited) {
    void recordAppEvent({
      eventName: "timer_pomo_duplicate_ignored",
      route: "/",
      entityType: "session",
      entityId: sessionId,
      metadata: { taskId },
    });
    return false;
  }

  await useTaskStore.getState().incrementPomos(taskId, review, {
    alreadyPersisted: true,
    sessionId,
  });
  return true;
}
