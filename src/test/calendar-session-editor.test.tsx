import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarSessionEditor } from "@/components/base/calendar-session-editor";
import { CalendarSessionBlock } from "@/components/base/calendar-session-block";
import type { Task } from "@/features/tasks/task-types";
import type { WeekSession } from "@/lib/db";

const sourceTask: Task = {
  id: 12,
  name: "背诵",
  estimated_pomos: 2,
  completed_pomos: 2,
  category_id: 69,
  created_at: "2026-07-16 09:00:00",
  archived: 0,
};

const targetTask: Task = {
  id: 13,
  name: "复习 ANKI",
  project: "ANKI",
  estimated_pomos: 1,
  completed_pomos: 0,
  category_id: 69,
  scheduled_for: "2026-07-16T09:00:00",
  created_at: "2026-07-16 09:00:00",
  archived: 0,
};

const completedTargetTask: Task = {
  id: 14,
  name: "早间复习",
  estimated_pomos: 1,
  completed_pomos: 1,
  category_id: 69,
  scheduled_for: "2026-07-15T09:00:00",
  completed_at: "2026-07-16 11:00:00",
  created_at: "2026-07-16 09:00:00",
  archived: 0,
};

const completedPomo: WeekSession = {
  id: 93,
  task_id: 12,
  task_name: "背诵",
  phase: "work",
  started_at: "2026-07-16 10:30:00",
  duration_sec: 1500,
  completed: 1,
  pomo_counted: 1,
  category_id: 69,
  category_name: "记忆复习",
  category_color: "#489E8A",
  intention: "记忆复习",
  mood: null,
  notes: null,
};

const standaloneCompletedPomo: WeekSession = {
  ...completedPomo,
  id: 95,
  task_id: null,
  task_name: null,
  category_id: null,
  category_name: null,
  category_color: null,
  intention: "独立整理思路",
};

const shortBreak: WeekSession = {
  id: 94,
  task_id: null,
  task_name: null,
  phase: "short_break",
  started_at: "2026-07-16 10:55:00",
  duration_sec: 300,
  completed: 1,
  pomo_counted: 0,
  category_id: null,
  category_name: null,
  category_color: null,
  intention: "喝水休息",
  mood: null,
  notes: null,
};

describe("Calendar completed-pomodoro editor", () => {
  it("searches for and changes one calendar pomodoro to a selected task", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CalendarSessionEditor
        open
        session={completedPomo}
        tasks={[sourceTask, targetTask]}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("更正番茄归属")).toBeVisible();
    expect(screen.getByText(/10:30.*10:55.*25 分钟/)).toBeVisible();

    fireEvent.change(screen.getByLabelText("搜索所属任务"), {
      target: { value: "anki" },
    });
    expect(screen.getByText("同一天任务")).toBeVisible();
    expect(screen.getByText("同一天 7月16日 · ANKI · 0/1 番茄")).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "选择任务 复习 ANKI，同一天 7月16日，0/1 番茄" }));
    fireEvent.click(screen.getByRole("button", { name: "保存归属" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(13));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("only makes completed, credited focus cards editable", () => {
    const onEditPomo = vi.fn();
    const { rerender } = render(
      <CalendarSessionBlock
        session={completedPomo}
        topPx={0}
        heightPx={60}
        onEditPomo={onEditPomo}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /更正番茄归属/ }));
    expect(onEditPomo).toHaveBeenCalledWith(completedPomo);

    rerender(
      <CalendarSessionBlock
        session={{ ...completedPomo, pomo_counted: 0 }}
        topPx={0}
        heightPx={60}
        onEditPomo={onEditPomo}
      />,
    );
    expect(screen.queryByRole("button", { name: /更正番茄归属/ })).not.toBeInTheDocument();
  });

  it("makes a completed standalone pomodoro editable from the calendar", () => {
    const onEditPomo = vi.fn();
    render(
      <CalendarSessionBlock
        session={standaloneCompletedPomo}
        topPx={0}
        heightPx={40}
        onEditPomo={onEditPomo}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /更正番茄归属：独立整理思路/,
      }),
    );

    expect(onEditPomo).toHaveBeenCalledWith(standaloneCompletedPomo);
  });

  it("makes the task name the first visible work-card label", () => {
    render(
      <CalendarSessionBlock
        session={completedPomo}
        topPx={0}
        heightPx={72}
      />,
    );

    expect(screen.getByText("背诵")).toBeVisible();
    expect(screen.queryByText("专注")).not.toBeInTheDocument();
  });

  it("uses the restorative green treatment for break cards", () => {
    render(
      <CalendarSessionBlock
        session={shortBreak}
        topPx={0}
        heightPx={72}
      />,
    );

    expect(screen.getByText("短休息")).toBeVisible();
    expect(screen.getByRole("group", { name: /短休息/ })).toHaveClass("calendar-break-session");
  });

  it("allows correcting history to another visible task that is already complete", () => {
    render(
      <CalendarSessionEditor
        open
        session={completedPomo}
        tasks={[sourceTask, completedTargetTask]}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText("搜索所属任务"), {
      target: { value: "早间" },
    });

    expect(screen.getByRole("option", { name: "选择任务 早间复习，计划于 7月15日，1/1 番茄，已完成" })).toBeVisible();
  });
});
