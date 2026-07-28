import { fireEvent, render, screen } from "@testing-library/react";
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

      const row = screen.getByTitle("整理任务树视觉").closest("article");
      const progress = screen.getByLabelText(
        `番茄进度 ${completedPomos}/4`,
      );
      const prefix = screen.getByText("专注：");
      expect(row).toHaveAttribute("data-pomo-tone", tone);
      expect(progress).toHaveClass(toneClassName);
      expect(prefix).toHaveClass(toneClassName);
    },
  );

  it("uses completion color for a finished focus task", () => {
    renderFocusTask({
      ...focusTask,
      completed_pomos: 3,
      completed_at: "2026-07-28T12:00:00.000Z",
    });

    const row = screen.getByTitle("整理任务树视觉").closest("article");
    expect(row).toHaveAttribute("data-pomo-tone", "complete");
    expect(screen.getByLabelText("番茄进度 3/4")).toHaveClass(
      "task-pomo-complete",
    );
    expect(screen.getByText("专注：")).toHaveClass("task-pomo-complete");
  });

  it("uses the shared checkbox to open the focus completion flow", () => {
    const onCompleteFocus = vi.fn();
    const onToggleTodo = vi.fn();
    render(
      <TaskTreeRow
        task={focusTask}
        onCompleteFocus={onCompleteFocus}
        onToggleTodo={onToggleTodo}
        onRename={vi.fn(() => true)}
        onDelete={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "完成专注任务：整理任务树视觉",
    });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onCompleteFocus).toHaveBeenCalledOnce();
    expect(onToggleTodo).not.toHaveBeenCalled();
  });

  it("uses the shared checkbox to directly complete a todo", () => {
    const onToggleTodo = vi.fn();
    render(
      <TaskTreeRow
        task={{ ...focusTask, name: "洗衣服", item_type: "todo" }}
        onToggleTodo={onToggleTodo}
        onRename={vi.fn(() => true)}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "完成待办：洗衣服" }),
    );
    expect(onToggleTodo).toHaveBeenCalledOnce();
    expect(screen.queryByText("专注：")).not.toBeInTheDocument();
  });

  it("reopens a completed focus task through the shared checkbox", () => {
    const onToggleTodo = vi.fn();
    render(
      <TaskTreeRow
        task={{
          ...focusTask,
          completed_at: "2026-07-28T12:00:00.000Z",
        }}
        onToggleTodo={onToggleTodo}
        onRename={vi.fn(() => true)}
        onDelete={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "重新打开专注任务：整理任务树视觉",
    });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(onToggleTodo).toHaveBeenCalledOnce();
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
