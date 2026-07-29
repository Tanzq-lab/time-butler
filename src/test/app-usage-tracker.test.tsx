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

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

function eventsNamed(eventName: string) {
  return recordAppEvent.mock.calls
    .map(([event]) => event)
    .filter((event) => event.eventName === eventName);
}

describe("AppUsageTracker", () => {
  beforeEach(() => {
    recordAppEvent.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T02:00:00.000Z"));
    setVisibility("visible");
  });

  afterEach(() => {
    setVisibility("visible");
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
      metadata: {
        reason: "initial_visible",
        visibleSessionSequence: expect.any(Number),
      },
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

    setVisibility("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "app_visibility_changed",
      route: "/tasks",
      metadata: {
        state: "hidden",
        sessionElapsedMs: 1_250,
        visibleSessionSequence: expect.any(Number),
      },
    });
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "app_usage_session_ended",
      route: "/tasks",
      metadata: {
        reason: "document_hidden",
        durationMs: 1_250,
        visibleSessionSequence: expect.any(Number),
      },
    });

    unmount();
    expect(eventsNamed("app_usage_session_ended")).toHaveLength(1);
  });

  it("starts on first visibility and ends once when hidden or page-hidden", () => {
    setVisibility("hidden");
    const { unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AppUsageTracker />
      </MemoryRouter>,
    );

    expect(eventsNamed("app_usage_session_started")).toHaveLength(0);

    vi.advanceTimersByTime(500);
    setVisibility("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(eventsNamed("app_usage_session_started")).toEqual([
      expect.objectContaining({
        route: "/",
        metadata: expect.objectContaining({ reason: "became_visible" }),
      }),
    ]);

    vi.advanceTimersByTime(1_000);
    setVisibility("hidden");
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("pagehide"));
    expect(eventsNamed("app_usage_session_ended")).toEqual([
      expect.objectContaining({
        route: "/",
        metadata: expect.objectContaining({
          reason: "document_hidden",
          durationMs: 1_000,
        }),
      }),
    ]);

    unmount();
    expect(eventsNamed("app_usage_session_ended")).toHaveLength(1);
  });

  it("does not create a second session when the tracker remounts", () => {
    const first = render(
      <MemoryRouter initialEntries={["/"]}>
        <AppUsageTracker />
      </MemoryRouter>,
    );
    expect(eventsNamed("app_usage_session_started")).toHaveLength(1);

    first.unmount();
    expect(eventsNamed("app_usage_session_ended")).toHaveLength(0);

    const second = render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <AppUsageTracker />
      </MemoryRouter>,
    );
    expect(eventsNamed("app_usage_session_started")).toHaveLength(1);

    vi.advanceTimersByTime(800);
    setVisibility("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(eventsNamed("app_usage_session_ended")).toEqual([
      expect.objectContaining({
        route: "/tasks",
        metadata: expect.objectContaining({
          reason: "document_hidden",
          durationMs: 800,
        }),
      }),
    ]);

    second.unmount();
  });
});
