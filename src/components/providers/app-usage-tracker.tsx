import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { recordAppEvent } from "@/lib/db";

interface VisibleUsageSessionState {
  startedAtMs: number | null;
  sequence: number;
}

const hotData = import.meta.hot?.data as
  | { visibleUsageSessionState?: VisibleUsageSessionState }
  | undefined;
const visibleUsageSessionState: VisibleUsageSessionState =
  hotData?.visibleUsageSessionState ?? {
    startedAtMs: null,
    sequence: 0,
  };

if (hotData) {
  hotData.visibleUsageSessionState = visibleUsageSessionState;
}

export function AppUsageTracker() {
  const location = useLocation();
  const previousRoute = useRef<string | null>(null);
  const currentRoute = useRef(location.pathname);

  currentRoute.current = location.pathname;

  useEffect(() => {
    const startVisibleSession = (
      reason: "initial_visible" | "became_visible",
    ) => {
      if (
        document.visibilityState !== "visible"
        || visibleUsageSessionState.startedAtMs != null
      ) {
        return;
      }
      visibleUsageSessionState.startedAtMs = Date.now();
      visibleUsageSessionState.sequence += 1;
      void recordAppEvent({
        eventName: "app_usage_session_started",
        route: currentRoute.current,
        metadata: {
          reason,
          visibleSessionSequence: visibleUsageSessionState.sequence,
        },
      });
    };

    const recordSessionEnd = (
      reason: "document_hidden" | "page_hidden",
    ) => {
      const startedAtMs = visibleUsageSessionState.startedAtMs;
      if (startedAtMs == null) return;
      visibleUsageSessionState.startedAtMs = null;
      void recordAppEvent({
        eventName: "app_usage_session_ended",
        route: currentRoute.current,
        metadata: {
          reason,
          durationMs: Math.max(0, Date.now() - startedAtMs),
          visibleSessionSequence: visibleUsageSessionState.sequence,
        },
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startVisibleSession("became_visible");
      }
      void recordAppEvent({
        eventName: "app_visibility_changed",
        route: currentRoute.current,
        metadata: {
          state: document.visibilityState,
          sessionElapsedMs:
            visibleUsageSessionState.startedAtMs == null
              ? null
              : Math.max(
                0,
                Date.now() - visibleUsageSessionState.startedAtMs,
              ),
          visibleSessionSequence: visibleUsageSessionState.sequence,
        },
      });
      if (document.visibilityState === "hidden") {
        recordSessionEnd("document_hidden");
      }
    };

    const handlePageHide = () => recordSessionEnd("page_hidden");

    startVisibleSession("initial_visible");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    const route = location.pathname;
    const enteredAtMs = Date.now();
    let visibleSinceMs =
      document.visibilityState === "visible" ? enteredAtMs : null;
    let visibleDurationMs = 0;
    let exited = false;

    void recordAppEvent({
      eventName: "route_viewed",
      route,
      metadata: {
        fromRoute: previousRoute.current,
        hasSearch: location.search.length > 0,
      },
    });
    previousRoute.current = route;

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        visibleSinceMs = now;
      } else if (visibleSinceMs != null) {
        visibleDurationMs += Math.max(0, now - visibleSinceMs);
        visibleSinceMs = null;
      }
    };

    const recordRouteExit = (reason: "route_changed" | "page_hidden") => {
      if (exited) return;
      exited = true;
      const exitedAtMs = Date.now();
      const finalVisibleDurationMs =
        visibleDurationMs
        + (visibleSinceMs == null ? 0 : Math.max(0, exitedAtMs - visibleSinceMs));
      void recordAppEvent({
        eventName: "route_exited",
        route,
        metadata: {
          reason,
          durationMs: Math.max(0, exitedAtMs - enteredAtMs),
          visibleDurationMs: finalVisibleDurationMs,
          hadSearch: location.search.length > 0,
        },
      });
    };

    const handlePageHide = () => recordRouteExit("page_hidden");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      recordRouteExit("route_changed");
    };
  }, [location.pathname, location.search]);

  return null;
}
