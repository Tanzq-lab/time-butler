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
  it("marks an unfinished task within its estimate as normal progress", () => {
    render(
      <TaskListCard
        task={{ ...task, completed_pomos: 2 }}
        isActive={false}
        onToggleActive={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCompleteTask={vi.fn()}
      />,
    );

    const card = screen.getByText("补齐任务记录入口").closest("article");
    expect(card).toHaveAttribute("data-progress-state", "on-track");
    expect(screen.getByText("正常进度")).toHaveClass("text-emerald-700");
    expect(
      screen.getByRole("progressbar", { name: "补齐任务记录入口 任务进度" }),
    ).toHaveAttribute("aria-valuetext", "2/2 个番茄，正常进度");
  });

  it("marks an unfinished task beyond its estimate as over budget", () => {
    render(
      <TaskListCard
        task={{ ...task, completed_pomos: 3 }}
        isActive={false}
        onToggleActive={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCompleteTask={vi.fn()}
      />,
    );

    const card = screen.getByText("补齐任务记录入口").closest("article");
    expect(card).toHaveAttribute("data-progress-state", "overrun");
    expect(screen.getByText("超额 1 个")).toHaveClass("text-red-700");
    expect(
      screen.getByRole("progressbar", { name: "补齐任务记录入口 任务进度" }),
    ).toHaveAttribute("aria-valuetext", "3/2 个番茄，超额 1 个");
  });

  it("keeps completed tasks outside the active progress colour semantics", () => {
    render(
      <TaskListCard
        task={{
          ...task,
          completed_pomos: 3,
          completed_at: "2026-07-16T16:00:00.000Z",
        }}
        isActive={false}
        onToggleActive={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCompleteTask={vi.fn()}
      />,
    );

    const card = screen.getByText("补齐任务记录入口").closest("article");
    expect(card).not.toHaveAttribute("data-progress-state");
    expect(screen.queryByText("超额 1 个")).not.toBeInTheDocument();
  });

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
