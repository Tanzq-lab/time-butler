import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/task-types";
import { useTaskFilter } from "@/features/tasks/use-task-filter";

const baseTask: Omit<Task, "id" | "name" | "estimated_pomos" | "completed_pomos"> = {
  category_id: null,
  created_at: "2026-06-22T00:00:00",
  archived: 0,
};

describe("useTaskFilter", () => {
  it("keeps future scheduled tasks out of active tasks", () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        id: 1,
        name: "Do now",
        estimated_pomos: 1,
        completed_pomos: 0,
      },
      {
        ...baseTask,
        id: 2,
        name: "Apply for unemployment benefit",
        estimated_pomos: 1,
        completed_pomos: 0,
        scheduled_for: "2099-07-01T09:00:00+08:00",
      },
    ];

    const { result } = renderHook(() => useTaskFilter(tasks, ""));

    expect(result.current.active.map((task) => task.name)).toEqual(["Do now"]);
    expect(result.current.scheduled.map((task) => task.name)).toEqual([
      "Apply for unemployment benefit",
    ]);
  });

  it("treats manually completed tasks as done even when actual pomos are lower than estimate", () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        id: 1,
        name: "Finished early",
        estimated_pomos: 4,
        completed_pomos: 2,
        completed_at: "2026-06-22T14:30:00+08:00",
        completion_review: "需求比预期简单",
      },
    ];

    const { result } = renderHook(() => useTaskFilter(tasks, ""));

    expect(result.current.active).toHaveLength(0);
    expect(result.current.done.map((task) => task.name)).toEqual([
      "Finished early",
    ]);
  });
});
