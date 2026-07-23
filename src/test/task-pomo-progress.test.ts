import { describe, expect, it } from "vitest";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("getTaskPomoProgressVisual", () => {
  it("keeps normal-budget pomodoros neutral", () => {
    expect(getTaskPomoProgressVisual(0, 4)).toMatchObject({
      label: "0/4",
      tone: "neutral",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("warns during the final estimated pomodoro", () => {
    expect(getTaskPomoProgressVisual(3, 4)).toMatchObject({
      label: "3/4",
      tone: "warning",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("starts an over-budget pomodoro in danger without raising an overrun warning early", () => {
    expect(getTaskPomoProgressVisual(4, 4)).toMatchObject({
      label: "4/4",
      tone: "danger",
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
