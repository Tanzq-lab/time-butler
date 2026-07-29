import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskCompletionReviewModal } from "@/components/base/task-completion-review-modal";
import type { Task } from "@/features/tasks/task-types";

const task: Task = {
  id: 1,
  name: "写一版方案",
  estimated_pomos: 4,
  completed_pomos: 2,
  category_id: null,
  created_at: "2026-06-22T00:00:00",
  archived: 0,
};

const history = [
  {
    id: "completion:2",
    kind: "completion" as const,
    estimated_pomos: 3,
    actual_pomos: 5,
    review: "接口联调比预期复杂。",
    recorded_at: "2026-07-28 15:30:00",
  },
  {
    id: "completion:1",
    kind: "completion" as const,
    estimated_pomos: 4,
    actual_pomos: 4,
    review: null,
    recorded_at: "2026-07-20 10:00:00",
  },
];

describe("TaskCompletionReviewModal", () => {
  it("requires a review reason when actual pomos differ from the estimate", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskCompletionReviewModal
        open
        task={task}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole("button", {
      name: /保存完成记录/,
    });
    expect(screen.getByText("比预估少 2 个番茄")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/复盘原因/), {
      target: { value: "需求比预期简单，提前做完。" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      actualPomos: 2,
      review: "需求比预期简单，提前做完。",
    });
  });

  it("shows past completion estimates, actuals, reasons, and timestamps", () => {
    render(
      <TaskCompletionReviewModal
        open
        task={task}
        history={history}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "历史复盘" })).toBeVisible();
    expect(screen.getByText("2 条")).toBeVisible();
    expect(screen.getByText("接口联调比预期复杂。")).toBeVisible();
    expect(screen.getByText("比预估多 2 个番茄")).toBeVisible();
    expect(screen.getByText("未填写复盘原因")).toBeVisible();
    expect(screen.getByText(/2026年7月28日/)).toBeVisible();
  });

  it("explains when the task has no completion history yet", () => {
    render(
      <TaskCompletionReviewModal
        open
        task={task}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "还没有历史复盘。完成复盘或超额路线复核后，记录会保留在这里。",
      ),
    ).toBeVisible();
  });

  it("shows a retryable error instead of an inaccurate empty state", () => {
    render(
      <TaskCompletionReviewModal
        open
        task={task}
        historyError
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "无法读取历史复盘。请关闭弹窗后重试。",
    );
    expect(screen.queryByText(/还没有历史复盘/)).not.toBeInTheDocument();
  });
});
