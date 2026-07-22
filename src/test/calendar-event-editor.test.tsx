import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarEventBlock } from "@/components/base/calendar-event-block";
import { CalendarEventEditor } from "@/components/base/calendar-event-editor";
import type { CalendarEvent } from "@/lib/db";

const event: CalendarEvent = {
  id: 21,
  title: "产品周会",
  starts_at: "2026-07-22 10:00:00",
  ends_at: "2026-07-22 11:00:00",
  notes: "确认下一轮实验",
  created_at: "2026-07-22 09:00:00",
  updated_at: "2026-07-22 09:00:00",
};

describe("CalendarEventEditor", () => {
  it("creates a non-focus time record from the selected range", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CalendarEventEditor
        open
        event={null}
        initialRange={{
          startsAt: "2026-07-22 14:15:00",
          endsAt: "2026-07-22 15:00:00",
        }}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("不计入专注 · 只说明时间去向")).toBeVisible();
    expect(screen.getByDisplayValue("14:15")).toBeVisible();
    expect(screen.getByDisplayValue("15:00")).toBeVisible();
    expect(screen.getByText("45 分钟")).toBeVisible();

    fireEvent.change(screen.getByLabelText("内容"), { target: { value: "客户沟通" } });
    fireEvent.change(screen.getByLabelText(/备注/), { target: { value: "确认交付范围" } });
    fireEvent.click(screen.getByRole("button", { name: "保存时间" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      title: "客户沟通",
      startsAt: "2026-07-22 14:15:00",
      endsAt: "2026-07-22 15:00:00",
      notes: "确认交付范围",
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("edits and requests deletion of an existing record", () => {
    const onRequestDelete = vi.fn();
    render(
      <CalendarEventEditor
        open
        event={event}
        initialRange={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onRequestDelete={onRequestDelete}
      />,
    );

    expect(screen.getByDisplayValue("产品周会")).toBeVisible();
    expect(screen.getByDisplayValue("确认下一轮实验")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "删除记录" }));
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarEventBlock", () => {
  it("is visibly and semantically editable without looking like a focus session", () => {
    const onEdit = vi.fn();
    render(<CalendarEventBlock event={event} topPx={0} heightPx={96} onEdit={onEdit} />);

    const button = screen.getByRole("button", { name: /编辑时间：产品周会，10:00 – 11:00/ });
    expect(button).toHaveClass("calendar-event");
    expect(button).not.toHaveClass("calendar-work-session");
    fireEvent.click(button);
    expect(onEdit).toHaveBeenCalledWith(event);
  });
});
