import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskTreeRow } from "@/components/base/task-tree-row";
import type { Task } from "@/features/tasks/task-types";

const focusTask: Task = {
  id: 71,
  name: "整理任务树视觉",
  item_type: "focus",
  estimated_pomos: 4,
  completed_pomos: 0,
  category_id: null,
  created_at: "2026-07-28T10:00:00.000Z",
  archived: 0,
};

function renderFocusTask(task: Task) {
  return render(
    <TaskTreeRow
      task={task}
      onRename={vi.fn(() => true)}
      onDelete={vi.fn()}
    />,
  );
}

describe("TaskTreeRow", () => {
  it.each([
    [0, "not-started", "task-pomo-not-started"],
    [1, "start", "timer-task-pomo-start"],
    [2, "progress", "timer-task-pomo-progress"],
    [3, "caution", "timer-task-pomo-caution"],
    [4, "final-in-budget", "timer-task-pomo-final-in-budget"],
    [5, "overrun", "timer-task-pomo-overrun"],
  ] as const)(
    "uses the %s/4 pomodoro budget tone",
    (completedPomos, tone, toneClassName) => {
      renderFocusTask({ ...focusTask, completed_pomos: completedPomos });

      const row = screen.getByText("整理任务树视觉").closest("article");
      const progress = screen.getByLabelText(
        `番茄进度 ${completedPomos}/4`,
      );
      expect(row).toHaveAttribute("data-pomo-tone", tone);
      expect(progress).toHaveClass(toneClassName);
    },
  );

  it("uses completion color for a finished focus task", () => {
    renderFocusTask({
      ...focusTask,
      completed_pomos: 3,
      completed_at: "2026-07-28T12:00:00.000Z",
    });

    const row = screen.getByText("整理任务树视觉").closest("article");
    expect(row).toHaveAttribute("data-pomo-tone", "complete");
    expect(screen.getByLabelText("番茄进度 3/4")).toHaveClass(
      "task-pomo-complete",
    );
  });

  it("turns a complete child-progress bar green without striking the group title", () => {
    render(
      <TaskTreeRow
        task={{ ...focusTask, name: "发布 Time Butler", completed_at: "2026-07-28T12:00:00.000Z" }}
        childCount={3}
        completedChildCount={3}
        onRename={vi.fn(() => true)}
        onDelete={vi.fn()}
      />,
    );

    const title = screen.getByText("发布 Time Butler");
    const progress = screen.getByRole("progressbar", {
      name: "发布 Time Butler 子任务进度",
    });
    expect(title).not.toHaveClass("line-through");
    expect(progress.firstElementChild).toHaveClass(
      "bg-[var(--color-timer-complete)]",
    );
  });
});
