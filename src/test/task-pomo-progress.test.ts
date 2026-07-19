import { describe, expect, it } from "vitest";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("getTaskPomoProgressVisual", () => {
  it("starts the first pomodoro at green and ends it at the next continuous budget colour", () => {
    expect(getTaskPomoProgressVisual(0, 4)).toMatchObject({
      label: "0/4",
      color: "#2f7d4e",
      darkColor: "#6cc88a",
      gradientEndColor: "#508145",
      gradientEndDarkColor: "#8fc77a",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("starts an over-budget pomodoro as an all-red ring without raising an overrun warning early", () => {
    expect(getTaskPomoProgressVisual(4, 4)).toMatchObject({
      label: "4/4",
      color: "#b42318",
      darkColor: "#fb7a70",
      gradientEndColor: "#b42318",
      gradientEndDarkColor: "#fb7a70",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("joins adjacent pomodoros with the same boundary colour", () => {
    const firstPomo = getTaskPomoProgressVisual(0, 2);
    const secondPomo = getTaskPomoProgressVisual(1, 2);

    expect(firstPomo?.gradientEndColor).toBe("#70843c");
    expect(secondPomo?.color).toBe(firstPomo?.gradientEndColor);
    expect(secondPomo?.gradientEndColor).toBe("#946200");
  });

  it("keeps the true count and raises an overrun warning after the estimate", () => {
    expect(getTaskPomoProgressVisual(5, 4)).toMatchObject({
      label: "5/4",
      color: "#b42318",
      darkColor: "#fb7a70",
      gradientEndColor: "#b42318",
      gradientEndDarkColor: "#fb7a70",
      isOverrun: true,
      overrunPomos: 1,
    });
  });

  it("does not show a budget signal when a task has no valid estimate", () => {
    expect(getTaskPomoProgressVisual(0, 0)).toBeNull();
  });
});
