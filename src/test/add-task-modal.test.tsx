import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddTaskModal } from "@/components/base/add-task-modal";
import type { Task } from "@/features/tasks/task-types";

const editTask: Task = {
  id: 8,
  name: "整理投资备忘录",
  project: "投资",
  priority: "high",
  estimated_pomos: 3,
  completed_pomos: 0,
  category_id: 1,
  created_at: "2026-07-19T09:00:00.000Z",
  archived: 0,
};

describe("AddTaskModal", () => {
  it("requires an explicit 1–4 pomodoro choice and submits only focused task data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<AddTaskModal open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "优化投资Agent工作流" },
    });

    const submit = screen.getByRole("button", { name: /创建任务/ });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("button", { name: "预计 1 个番茄" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByLabelText("优先级")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/项目/)).not.toBeInTheDocument();
    expect(screen.queryByText("手动指定分类")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预计 2 个番茄" }));
    expect(submit).toBeEnabled();
    expect(screen.getByRole("button", { name: "预计 2 个番茄" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "优化投资Agent工作流",
      estimatedPomos: 2,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preselects an existing task's valid estimate without exposing its legacy fields", () => {
    render(<AddTaskModal open onClose={vi.fn()} onSubmit={vi.fn()} editTask={editTask} />);

    expect(screen.getByLabelText("任务名称")).toHaveValue("整理投资备忘录");
    expect(screen.getByRole("button", { name: "预计 3 个番茄" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("投资")).not.toBeInTheDocument();
    expect(screen.queryByText("高")).not.toBeInTheDocument();
  });

  it("prefills a converted todo and stays open when creation fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();

    render(
      <AddTaskModal
        open
        initialName="购买显示器支架"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("任务名称")).toHaveValue("购买显示器支架");
    fireEvent.click(screen.getByRole("button", { name: "预计 1 个番茄" }));
    fireEvent.click(screen.getByRole("button", { name: /创建任务/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "购买显示器支架",
      estimatedPomos: 1,
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "新建任务" })).toBeVisible();
  });
});
