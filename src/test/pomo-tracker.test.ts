import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordPomoCompletion } from "@/features/timer/pomo-tracker";

const mocks = vi.hoisted(() => ({
  creditSessionPomo: vi.fn(),
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
  incrementPomos: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  creditSessionPomo: mocks.creditSessionPomo,
  recordAppEvent: mocks.recordAppEvent,
}));

vi.mock("@/features/tasks/use-task-store", () => ({
  useTaskStore: {
    getState: () => ({ incrementPomos: mocks.incrementPomos }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordPomoCompletion", () => {
  it("credits a completed work session once", async () => {
    mocks.creditSessionPomo.mockResolvedValueOnce(true);

    const credited = await recordPomoCompletion("work", 514, 254);

    expect(credited).toBe(true);
    expect(mocks.creditSessionPomo).toHaveBeenCalledWith(514);
    expect(mocks.incrementPomos).toHaveBeenCalledWith(254, undefined, {
      alreadyPersisted: true,
      sessionId: 514,
    });
  });

  it("ignores a duplicate completion for the same session", async () => {
    mocks.creditSessionPomo.mockResolvedValueOnce(false);

    const credited = await recordPomoCompletion("work", 514, 254);

    expect(credited).toBe(false);
    expect(mocks.incrementPomos).not.toHaveBeenCalled();
    expect(mocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "timer_pomo_duplicate_ignored",
        entityType: "session",
        entityId: 514,
      }),
    );
  });

  it("does not credit breaks", async () => {
    const credited = await recordPomoCompletion("short_break", 515, null);

    expect(credited).toBe(false);
    expect(mocks.creditSessionPomo).not.toHaveBeenCalled();
    expect(mocks.incrementPomos).not.toHaveBeenCalled();
  });
});
