import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddTaskModal } from "@/components/base/add-task-modal";
import type { Category } from "@/lib/db/types";

const categories: Category[] = [
  {
    id: 1,
    name: "工作流优化",
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
    fireEvent.click(screen.getByText("手动指定分类"));
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

  it("leaves category empty by default", async () => {
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
      target: { value: "写面试题框架" },
    });

    fireEvent.click(screen.getByRole("button", { name: /创建任务/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "写面试题框架",
      estimatedPomos: 4,
      project: "",
      priority: "",
      categoryId: null,
    });
  });

  it("uses only categories passed from the data layer", () => {
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

    fireEvent.click(screen.getByText("手动指定分类"));

    expect(screen.getByRole("option", { name: "工作流优化" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "新增分类" })).toBeNull();
    expect(screen.queryByPlaceholderText("输入新分类名称")).toBeNull();
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
        categories={categories}
      />,
    );

    expect(screen.getByLabelText("任务名称")).toHaveValue("购买显示器支架");
    fireEvent.click(screen.getByRole("button", { name: /创建任务/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "新建任务" })).toBeVisible();
  });
});
