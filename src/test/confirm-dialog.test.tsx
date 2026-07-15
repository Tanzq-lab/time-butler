import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function DialogHarness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>打开确认</button>
      <ConfirmDialog
        open={open}
        title="删除任务？"
        description="此操作无法撤销。"
        confirmLabel="删除任务"
        destructive
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("focuses a safe action, cancels without confirming, and restores focus", async () => {
    const onConfirm = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} />);

    const trigger = screen.getByRole("button", { name: "打开确认" });
    trigger.focus();
    fireEvent.click(trigger);

    const cancel = screen.getByRole("button", { name: "取消" });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("runs the confirmed destructive action", async () => {
    const onConfirm = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "打开确认" }));
    fireEvent.click(screen.getByRole("button", { name: "删除任务" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
