import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddTaskModal } from "@/components/base/add-task-modal";
import type { Category } from "@/lib/db/types";

const categories: Category[] = [
  {
    id: 1,
    name: "代码修改",
    color: "#c2652a",
    created_at: "2026-06-22T00:00:00",
  },
];

describe("AddTaskModal", () => {
  it("shows breakdown warning and adds suggested subtasks by default", async () => {
    const onSubmit = vi.fn();
    const onSubmitSubtasks = vi.fn().mockResolvedValue(undefined);

    render(
      <AddTaskModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onSubmitSubtasks={onSubmitSubtasks}
        categories={categories}
      />,
    );

    fireEvent.change(screen.getByLabelText("自然语言任务"), {
      target: {
        value:
          "加任务：完整实现 Codex 自然语言加任务入口、番茄预估、任务分解提醒、备忘录和日志机制。",
      },
    });

    expect(
      screen.getByText("这个任务预计超过 4 个番茄，建议拆分。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /仍然作为一个任务添加/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /按建议拆分添加/ }));

    await waitFor(() => expect(onSubmitSubtasks).toHaveBeenCalledTimes(1));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSubmitSubtasks.mock.calls[0][0].length).toBeGreaterThan(1);
  });
});
