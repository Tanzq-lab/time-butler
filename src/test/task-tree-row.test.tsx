import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const completedControl = screen.getByRole("checkbox", {
      name: "重新打开专注任务：整理任务树视觉",
    }).firstElementChild;
    expect(completedControl).toHaveClass(
      "border-[var(--color-timer-complete)]",
      "bg-[var(--color-timer-complete)]",
    );
    expect(screen.getByTitle("整理任务树视觉")).not.toHaveClass(
      "line-through",
    );
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
    const onEditDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <TaskTreeRow
        task={{
          ...focusTask,
          completed_at: "2026-07-28T12:00:00.000Z",
        }}
        onToggleTodo={onToggleTodo}
        onFocus={vi.fn()}
        onRecord={vi.fn()}
        onEditDetails={onEditDetails}
        onConvertToTodo={vi.fn()}
        onAddSubtask={vi.fn()}
        onRename={vi.fn(() => true)}
        onDelete={onDelete}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "重新打开专注任务：整理任务树视觉",
    });
    expect(checkbox).toBeChecked();
    expect(
      screen.queryByRole("group", {
        name: "任务操作：整理任务树视觉",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "编辑任务：整理任务树视觉",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "删除任务：整理任务树视觉",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(onToggleTodo).toHaveBeenCalledOnce();
    expect(onEditDetails).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("exits editing and removes task actions when a task becomes complete", () => {
    const onDelete = vi.fn();
    const row = (task: Task) => (
      <TaskTreeRow
        task={task}
        onToggleTodo={vi.fn()}
        onRename={vi.fn(() => true)}
        onDelete={onDelete}
      />
    );
    const { rerender } = render(row(focusTask));

    fireEvent.click(
      screen.getByRole("button", {
        name: "编辑任务：整理任务树视觉",
      }),
    );
    expect(
      screen.getByRole("textbox", {
        name: "编辑任务：整理任务树视觉",
      }),
    ).toBeVisible();

    rerender(
      row({
        ...focusTask,
        completed_at: "2026-07-28T12:00:00.000Z",
      }),
    );
    expect(
      screen.queryByRole("textbox", {
        name: "编辑任务：整理任务树视觉",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "删除任务：整理任务树视觉",
      }),
    ).not.toBeInTheDocument();

    rerender(row(focusTask));
    expect(
      screen.queryByRole("textbox", {
        name: "编辑任务：整理任务树视觉",
      }),
    ).not.toBeInTheDocument();
  });

  it("exposes unique secondary actions inline without a more menu", () => {
    const onFocus = vi.fn();
    const onRecord = vi.fn();
    const onEditDetails = vi.fn();
    const onConvertToTodo = vi.fn();
    const onAddSubtask = vi.fn();
    const onDelete = vi.fn();
    render(
      <TaskTreeRow
        task={focusTask}
        onFocus={onFocus}
        onRecord={onRecord}
        onEditDetails={onEditDetails}
        onConvertToTodo={onConvertToTodo}
        onAddSubtask={onAddSubtask}
        onCompleteFocus={vi.fn()}
        onRename={vi.fn(() => true)}
        onDelete={onDelete}
      />,
    );

    const actions = within(
      screen.getByRole("group", {
        name: "任务操作：整理任务树视觉",
      }),
    );
    expect(
      actions.queryByRole("button", { name: /更多操作/ }),
    ).not.toBeInTheDocument();
    expect(
      actions.queryByRole("button", { name: /完成任务/ }),
    ).not.toBeInTheDocument();

    for (const name of [
      "开始专注：整理任务树视觉",
      "添加子任务：整理任务树视觉",
      "记录任务：整理任务树视觉",
      "编辑任务：整理任务树视觉",
      "改为普通待办：整理任务树视觉",
      "删除任务：整理任务树视觉",
    ]) {
      fireEvent.click(actions.getByRole("button", { name }));
    }

    expect(onFocus).toHaveBeenCalledOnce();
    expect(onAddSubtask).toHaveBeenCalledOnce();
    expect(onRecord).toHaveBeenCalledOnce();
    expect(onEditDetails).toHaveBeenCalledOnce();
    expect(onConvertToTodo).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it.each([1, 2])(
    "hides focus-to-todo conversion after %s completed pomodoro(s)",
    (completedPomos) => {
      render(
        <TaskTreeRow
          task={{ ...focusTask, completed_pomos: completedPomos }}
          onConvertToTodo={vi.fn()}
          onRename={vi.fn(() => true)}
          onDelete={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", {
          name: "改为普通待办：整理任务树视觉",
        }),
      ).not.toBeInTheDocument();
    },
  );

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
      "task-pomo-complete",
      "bg-[var(--timer-task-pomo-color)]",
    );
    expect(
      screen.queryByRole("group", {
        name: "任务操作：发布 Time Butler",
      }),
    ).not.toBeInTheDocument();
  });

  it("uses child completion stages for every parent progress bar", () => {
    render(
      <TaskTreeRow
        task={{ ...focusTask, name: "AI 生成 2D 游戏", item_type: "todo" }}
        childCount={5}
        completedChildCount={4}
        focusChildCount={5}
        onRename={vi.fn(() => true)}
        onDelete={vi.fn()}
      />,
    );

    const row = screen.getByTitle("AI 生成 2D 游戏").closest("article");
    const prefix = screen.getByText("专注：");
    const progress = screen.getByRole("progressbar", {
      name: "AI 生成 2D 游戏 子任务进度",
    });
    expect(row).toHaveAttribute("data-task-kind", "group");
    expect(row).toHaveAttribute("data-progress-tone", "final-in-budget");
    expect(prefix).toHaveClass("timer-task-pomo-final-in-budget");
    expect(progress.firstElementChild).toHaveClass(
      "timer-task-pomo-final-in-budget",
      "bg-[var(--timer-task-pomo-color)]",
    );
  });

  it("uses the same child-progress tone without focus subtasks", () => {
    render(
      <TaskTreeRow
        task={{ ...focusTask, name: "整理房间", item_type: "todo" }}
        childCount={5}
        completedChildCount={4}
        onRename={vi.fn(() => true)}
        onDelete={vi.fn()}
      />,
    );

    const row = screen.getByTitle("整理房间").closest("article");
    const progress = screen.getByRole("progressbar", {
      name: "整理房间 子任务进度",
    });
    expect(row).toHaveAttribute("data-progress-tone", "final-in-budget");
    expect(progress.firstElementChild).toHaveClass(
      "timer-task-pomo-final-in-budget",
      "bg-[var(--timer-task-pomo-color)]",
    );
  });
});
