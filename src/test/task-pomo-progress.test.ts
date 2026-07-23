import { describe, expect, it } from "vitest";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("getTaskPomoProgressVisual", () => {
  it("keeps every pomodoro inside the estimate active, including a one-pomodoro task", () => {
    expect(getTaskPomoProgressVisual(0, 1)).toMatchObject({
      label: "0/1",
      tone: "active",
      isOverrun: false,
      overrunPomos: 0,
    });
    expect(getTaskPomoProgressVisual(3, 4)).toMatchObject({
      label: "3/4",
      tone: "active",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("warns when the estimate has been consumed without claiming an overrun", () => {
    expect(getTaskPomoProgressVisual(4, 4)).toMatchObject({
      label: "4/4",
      tone: "warning",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("keeps the true count and raises an overrun warning after the estimate", () => {
    expect(getTaskPomoProgressVisual(5, 4)).toMatchObject({
      label: "5/4",
      tone: "danger",
      isOverrun: true,
      overrunPomos: 1,
    });
  });

  it("does not show a budget signal when a task has no valid estimate", () => {
    expect(getTaskPomoProgressVisual(0, 0)).toBeNull();
  });
});
