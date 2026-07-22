import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddRecurringTaskModal,
  formatRecurringRuleSummary,
} from "@/components/base/add-recurring-task-modal";
import { useCategoriesStore } from "@/features/categories/use-categories-store";

beforeEach(() => {
  useCategoriesStore.setState({
    categories: [
      {
        id: 50,
        name: "复盘计划",
        color: "#F2CC8F",
        created_at: "2026-07-01T00:00:00",
      },
    ],
    loadCategories: vi.fn().mockResolvedValue(undefined),
  });
});

describe("AddRecurringTaskModal", () => {
  it("summarizes weekly and monthly cadence from the chosen start date", () => {
    expect(
      formatRecurringRuleSummary("weekly", "2026-07-22", "09:30"),
    ).toBe("从 7月22日起，每周三 09:30 生成任务");
    expect(
      formatRecurringRuleSummary("monthly", "2026-07-31", "18:00"),
    ).toBe("从 7月31日起，每月31日 18:00 生成任务");
  });

  it("requires the core fields and submits project and category separately", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <AddRecurringTaskModal
        open
        onClose={onClose}
        onSubmit={onSubmit}
        projectOptions={["时间管家", "个人复盘", "时间管家"]}
      />,
    );

    const submit = screen.getByRole("button", { name: "创建循环任务" });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("button", { name: "每天" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "整理本周复盘" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "循环任务预计 2 个番茄" }),
    );
    fireEvent.change(screen.getByLabelText(/项目/), {
      target: { value: "个人复盘" },
    });
    fireEvent.change(screen.getByLabelText(/分类/), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "每周" }));
    fireEvent.change(screen.getByLabelText("开始日期"), {
      target: { value: "2026-07-22" },
    });
    fireEvent.change(screen.getByLabelText("提醒时间"), {
      target: { value: "09:30" },
    });

    expect(screen.getByText("从 7月22日起，每周三 09:30 生成任务")).toBeVisible();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "整理本周复盘",
      estimatedPomos: 2,
      project: "个人复盘",
      categoryId: 50,
      frequency: "weekly",
      startDate: "2026-07-22",
      scheduledTime: "09:30",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the form open and explains a failed creation", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(
      <AddRecurringTaskModal open onClose={onClose} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "每日复习" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "循环任务预计 1 个番茄" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "创建循环任务" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "未能创建循环任务，请重试。",
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lets the user stop an existing rule without deleting generated tasks", async () => {
    const onToggleRule = vi.fn().mockResolvedValue(true);
    render(
      <AddRecurringTaskModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onToggleRule={onToggleRule}
        rules={[
          {
            id: 31,
            name: "每日整理收件箱",
            estimated_pomos: 1,
            project: "个人效率",
            category_id: null,
            category_name: null,
            frequency: "daily",
            start_date: "2026-07-22",
            scheduled_time: "09:00",
            enabled: 1,
            created_at: "2026-07-22T09:00:00",
            updated_at: "2026-07-22T09:00:00",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("已配置规则"));
    expect(
      screen.getByText(
        "可编辑或停用规则；修改仅影响之后新生成的任务，已经出现的任务会保留。",
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "停用循环规则：每日整理收件箱" }),
    );

    await waitFor(() =>
      expect(onToggleRule).toHaveBeenCalledWith(31, false),
    );
  });

  it("reuses the form to edit an existing rule and keeps generated tasks unchanged", async () => {
    const onUpdateRule = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <AddRecurringTaskModal
        open
        onClose={onClose}
        onSubmit={vi.fn()}
        onUpdateRule={onUpdateRule}
        rules={[
          {
            id: 31,
            name: "每日整理收件箱",
            estimated_pomos: 1,
            project: "个人效率",
            category_id: 50,
            category_name: "复盘计划",
            frequency: "daily",
            start_date: "2026-07-22",
            scheduled_time: "09:00",
            enabled: 1,
            created_at: "2026-07-22T09:00:00",
            updated_at: "2026-07-22T09:00:00",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("已配置规则"));
    fireEvent.click(
      screen.getByRole("button", { name: "编辑循环规则：每日整理收件箱" }),
    );

    expect(
      screen.getByRole("dialog", { name: "编辑循环任务" }),
    ).toBeVisible();
    expect(screen.getByLabelText("任务名称")).toHaveValue("每日整理收件箱");
    expect(screen.getByLabelText(/项目/)).toHaveValue("个人效率");
    expect(screen.getByLabelText(/分类/)).toHaveValue("50");
    expect(screen.getByRole("button", { name: "每天" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("开始日期")).toHaveValue("2026-07-22");
    expect(screen.getByLabelText("提醒时间")).toHaveValue("09:00");

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "每周整理收件箱" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "循环任务预计 2 个番茄" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "每周" }));
    fireEvent.change(screen.getByLabelText("提醒时间"), {
      target: { value: "10:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(onUpdateRule).toHaveBeenCalledWith(31, {
        name: "每周整理收件箱",
        estimatedPomos: 2,
        project: "个人效率",
        categoryId: 50,
        frequency: "weekly",
        startDate: "2026-07-22",
        scheduledTime: "10:30",
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "添加循环任务" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "循环规则已更新。修改只影响之后新生成的任务。",
    );
  });
});
