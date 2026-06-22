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
});
