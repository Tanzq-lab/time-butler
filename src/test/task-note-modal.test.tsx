import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskNoteModal } from "@/components/base/task-note-modal";
import type { Task } from "@/features/tasks/task-types";

const task: Task = {
  id: 7,
  name: "整理需求记录",
  estimated_pomos: 2,
  completed_pomos: 1,
  category_id: null,
  notes: "**2026-07-16 14:20**\n\n先确认用户路径。",
  created_at: "2026-07-16T14:00:00.000Z",
  archived: 0,
};

describe("TaskNoteModal", () => {
  it("submits a trimmed append-only task record", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <TaskNoteModal
        open
        task={task}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "任务记录" }), {
      target: { value: "  需要先补充边界条件。  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "附加记录" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("需要先补充边界条件。"),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open when saving fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(
      <TaskNoteModal
        open
        task={task}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "任务记录" }), {
      target: { value: "记录失败时仍能保留输入" },
    });
    fireEvent.click(screen.getByRole("button", { name: "附加记录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "暂时没能保存，请重试。",
    );
    expect(screen.getByRole("textbox", { name: "任务记录" })).toHaveValue(
      "记录失败时仍能保留输入",
    );
  });
});
