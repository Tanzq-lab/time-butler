import { describe, expect, it } from "vitest";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("getTaskPomoProgressVisual", () => {
  it("identifies the active pomodoro without counting it as completed", () => {
    expect(getTaskPomoProgressVisual(0, 1, true)).toMatchObject({
      completedPomos: 0,
      currentPomo: 1,
      isCurrentPomoOverEstimate: false,
      overrunPomos: 0,
      ringTone: "start",
    });
  });

  it("marks the second active pomodoro as over estimate for a one-pomodoro task", () => {
    expect(getTaskPomoProgressVisual(1, 1, true)).toMatchObject({
      completedPomos: 1,
      currentPomo: 2,
      isCurrentPomoOverEstimate: true,
      overrunPomos: 0,
      ringTone: "overrun",
    });
  });

  it("moves through the full budget color scale for a four-pomodoro task", () => {
    expect(getTaskPomoProgressVisual(0, 4, true)?.ringTone).toBe("start");
    expect(getTaskPomoProgressVisual(1, 4, true)?.ringTone).toBe("progress");
    expect(getTaskPomoProgressVisual(2, 4, true)?.ringTone).toBe("caution");
    expect(getTaskPomoProgressVisual(3, 4, true)?.ringTone).toBe("limit");
  });

  it("uses the endpoints and midpoint when the estimate has fewer positions", () => {
    expect(getTaskPomoProgressVisual(0, 2, true)?.ringTone).toBe("start");
    expect(getTaskPomoProgressVisual(1, 2, true)?.ringTone).toBe("limit");

    expect(getTaskPomoProgressVisual(0, 3, true)?.ringTone).toBe("start");
    expect(getTaskPomoProgressVisual(1, 3, true)?.ringTone).toBe("caution");
    expect(getTaskPomoProgressVisual(2, 3, true)?.ringTone).toBe("limit");
  });

  it("keeps every pomodoro beyond the estimate on the same red tone", () => {
    expect(getTaskPomoProgressVisual(4, 4, true)?.ringTone).toBe("overrun");
    expect(getTaskPomoProgressVisual(7, 4, true)?.ringTone).toBe("overrun");
  });

  it("keeps an on-budget completed task neutral when there is no active session", () => {
    expect(getTaskPomoProgressVisual(1, 1)).toMatchObject({
      currentPomo: null,
      isCurrentPomoOverEstimate: false,
      overrunPomos: 0,
      ringTone: null,
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
