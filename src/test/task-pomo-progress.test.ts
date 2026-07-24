import { describe, expect, it } from "vitest";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("getTaskPomoProgressVisual", () => {
  it("identifies the active pomodoro without counting it as completed", () => {
    expect(getTaskPomoProgressVisual(0, 1, true)).toMatchObject({
      completedPomos: 0,
      currentPomo: 1,
      isCurrentPomoOverEstimate: false,
      overrunPomos: 0,
    });
  });

  it("marks the second active pomodoro as over estimate for a one-pomodoro task", () => {
    expect(getTaskPomoProgressVisual(1, 1, true)).toMatchObject({
      completedPomos: 1,
      currentPomo: 2,
      isCurrentPomoOverEstimate: true,
      overrunPomos: 0,
    });
  });

  it("keeps an on-budget completed task neutral when there is no active session", () => {
    expect(getTaskPomoProgressVisual(1, 1)).toMatchObject({
      currentPomo: null,
      isCurrentPomoOverEstimate: false,
      overrunPomos: 0,
    });
  });

  it("reports only completed overrun after the extra pomodoro finishes", () => {
    expect(getTaskPomoProgressVisual(5, 4)).toMatchObject({
      completedPomos: 5,
      currentPomo: null,
      isCurrentPomoOverEstimate: false,
      overrunPomos: 1,
    });
  });

  it("does not show a budget signal when a task has no valid estimate", () => {
    expect(getTaskPomoProgressVisual(0, 0)).toBeNull();
  });
});
