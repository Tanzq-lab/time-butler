import type { TimerPhase } from "@/features/timer/timer-types";
import { useTaskStore } from "@/features/tasks/use-task-store";

export function recordPomoCompletion(
  phase: TimerPhase,
  taskId: number | null,
  review?: string,
) {
  if (phase === "work" && taskId) {
    return useTaskStore.getState().incrementPomos(taskId, review);
  }
  return Promise.resolve();
}
