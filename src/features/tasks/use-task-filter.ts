import { useMemo } from "react";
import { isTaskDone } from "@/features/tasks/task-completion";
import type { Task } from "@/features/tasks/task-types";

function isScheduledForFuture(task: Task): boolean {
  if (!task.scheduled_for) return false;

  const scheduledTime = new Date(task.scheduled_for).getTime();
  return Number.isFinite(scheduledTime) && scheduledTime > Date.now();
}

export function useTaskFilter(tasks: Task[], searchQuery: string) {
  return useMemo(() => {
    const filtered = tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.project || "").toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const active = filtered.filter(
      (t) =>
        !isTaskDone(t) && !isScheduledForFuture(t),
    );
    const scheduled = filtered.filter(
      (t) =>
        !isTaskDone(t) && isScheduledForFuture(t),
    );
    const done = filtered.filter(isTaskDone);

    return { filtered, active, scheduled, done };
  }, [tasks, searchQuery]);
}
