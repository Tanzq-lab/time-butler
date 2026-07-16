import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskListCard } from "@/components/base/task-list-card";
import type { Task } from "@/features/tasks/task-types";

const task: Task = {
  id: 9,
  name: "补齐任务记录入口",
  estimated_pomos: 2,
  completed_pomos: 0,
  category_id: null,
  created_at: "2026-07-16T14:00:00.000Z",
  archived: 0,
};

describe("TaskListCard", () => {
  it("exposes a compact record action for unfinished tasks", () => {
    const onRecord = vi.fn();
    render(
      <TaskListCard
        task={task}
        isActive={false}
        onToggleActive={vi.fn()}
        onRecord={onRecord}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCompleteTask={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "记录任务：补齐任务记录入口" }),
    );

    expect(onRecord).toHaveBeenCalledTimes(1);
  });
});
