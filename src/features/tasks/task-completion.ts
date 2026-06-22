import type { Task } from "@/features/tasks/task-types";

export function isTaskDone(task: Task): boolean {
  return Boolean(task.completed_at) || task.completed_pomos >= task.estimated_pomos;
}
