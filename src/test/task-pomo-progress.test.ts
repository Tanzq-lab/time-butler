import { describe, expect, it } from "vitest";
import {
  getTaskChildProgressTone,
  getTaskPomoProgressVisual,
} from "@/lib/task-pomo-progress";

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

  it("maps every supported estimate across its own in-budget color scale", () => {
    const expectedTonesByEstimate = [
      ["start"],
      ["start", "final-in-budget"],
      ["start", "caution", "final-in-budget"],
      ["start", "progress", "caution", "final-in-budget"],
    ] as const;

    expectedTonesByEstimate.forEach((expectedTones, estimateIndex) => {
      const estimatedPomos = estimateIndex + 1;
      const actualTones = expectedTones.map((_, completedPomos) =>
        getTaskPomoProgressVisual(
          completedPomos,
          estimatedPomos,
          true,
        )?.ringTone,
      );

      expect(actualTones).toEqual(expectedTones);
    });
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

  it.each([
    [0, 5, "not-started"],
    [1, 5, "final-in-budget"],
    [2, 5, "caution"],
    [3, 5, "progress"],
    [4, 5, "start"],
    [5, 5, "complete"],
  ] as const)(
    "maps %s/%s completed children from warm to green progress tones",
    (completedChildren, totalChildren, tone) => {
      expect(getTaskChildProgressTone(completedChildren, totalChildren)).toBe(
        tone,
      );
    },
  );

  it("keeps a two-child parent warm until the final completion", () => {
    expect(getTaskChildProgressTone(1, 2)).toBe("final-in-budget");
    expect(getTaskChildProgressTone(2, 2)).toBe("complete");
  });
});
