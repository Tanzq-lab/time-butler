import { describe, expect, it } from "vitest";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("getTaskPomoProgressVisual", () => {
  it("starts at green for an untouched task", () => {
    expect(getTaskPomoProgressVisual(0, 4)).toMatchObject({
      label: "0/4",
      color: "#2f7d4e",
      darkColor: "#6cc88a",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("reaches red at the estimate without raising an overrun warning", () => {
    expect(getTaskPomoProgressVisual(4, 4)).toMatchObject({
      label: "4/4",
      color: "#b42318",
      darkColor: "#fb7a70",
      isOverrun: false,
      overrunPomos: 0,
    });
  });

  it("uses the app's green, amber, and red semantic states", () => {
    expect(getTaskPomoProgressVisual(1, 4)?.color).toBe("#2f7d4e");
    expect(getTaskPomoProgressVisual(2, 4)?.color).toBe("#2f7d4e");
    expect(getTaskPomoProgressVisual(3, 4)?.color).toBe("#946200");
  });

  it("keeps the true count and raises an overrun warning after the estimate", () => {
    expect(getTaskPomoProgressVisual(5, 4)).toMatchObject({
      label: "5/4",
      color: "#b42318",
      darkColor: "#fb7a70",
      isOverrun: true,
      overrunPomos: 1,
    });
  });

  it("does not show a budget signal when a task has no valid estimate", () => {
    expect(getTaskPomoProgressVisual(0, 0)).toBeNull();
  });
});
