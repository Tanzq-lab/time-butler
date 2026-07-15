import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppUsageTracker } from "@/components/providers/app-usage-tracker";

const { recordAppEvent } = vi.hoisted(() => ({
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ recordAppEvent }));

function Harness() {
  const navigate = useNavigate();
  return (
    <>
      <AppUsageTracker />
      <button type="button" onClick={() => navigate("/tasks")}>
        Tasks
      </button>
    </>
  );
}

describe("AppUsageTracker", () => {
  beforeEach(() => {
    recordAppEvent.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T02:00:00.000Z"));
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.useRealTimers();
  });

  it("records route dwell, transitions, visibility, and the app session", async () => {
    const { getByRole, unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Harness />
      </MemoryRouter>,
    );

    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "app_usage_session_started",
      route: "/",
    });
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "route_viewed",
      route: "/",
      metadata: { fromRoute: null, hasSearch: false },
    });

    vi.advanceTimersByTime(1_250);
    fireEvent.click(getByRole("button", { name: "Tasks" }));

    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "route_exited",
      route: "/",
      metadata: {
        reason: "route_changed",
        durationMs: 1_250,
        visibleDurationMs: 1_250,
        hadSearch: false,
      },
    });
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "route_viewed",
      route: "/tasks",
      metadata: { fromRoute: "/", hasSearch: false },
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "app_visibility_changed",
      route: "/tasks",
      metadata: { state: "hidden", sessionElapsedMs: 1_250 },
    });

    unmount();
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "app_usage_session_ended",
      route: "/tasks",
      metadata: { reason: "tracker_unmounted", durationMs: 1_250 },
    });
  });
});
