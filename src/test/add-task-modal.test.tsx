import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddTaskModal } from "@/components/base/add-task-modal";
import type { Category } from "@/lib/db/types";

const categories: Category[] = [
  {
    id: 1,
    name: "工作",
    color: "#009a9a",
    created_at: "2026-06-22T00:00:00",
  },
];

describe("AddTaskModal", () => {
  it("submits manual task details", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <AddTaskModal
        open
        onClose={onClose}
        onSubmit={onSubmit}
        categories={categories}
      />,
    );

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "优化投资Agent工作流" },
    });
    fireEvent.change(screen.getByLabelText("预计番茄数"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("优先级"), {
      target: { value: "medium" },
    });
    fireEvent.change(screen.getByLabelText(/分类/), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(/项目/), {
      target: { value: "投资" },
    });

    fireEvent.click(screen.getByRole("button", { name: /创建任务/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "优化投资Agent工作流",
      estimatedPomos: 1,
      project: "投资",
      priority: "medium",
      categoryId: 1,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("creates a category inline and selects it for the task", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onCreateCategory = vi.fn().mockResolvedValue({
      id: 2,
      name: "阅读",
      color: "#6b9080",
      created_at: "2026-06-22T00:00:00",
    });

    render(
      <AddTaskModal
        open
        onClose={onClose}
        onSubmit={onSubmit}
        onCreateCategory={onCreateCategory}
        categories={categories}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新增分类" }));
    fireEvent.change(screen.getByPlaceholderText("输入新分类名称"), {
      target: { value: "阅读" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledWith("阅读"));

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "读产品文档" },
    });
    fireEvent.click(screen.getByRole("button", { name: /创建任务/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "读产品文档",
      estimatedPomos: 4,
      project: "",
      priority: "",
      categoryId: 2,
    });
  });
});
