import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { recordAppEvent } from "@/lib/db";

export function AppUsageTracker() {
  const location = useLocation();
  const previousRoute = useRef<string | null>(null);
  const currentRoute = useRef(location.pathname);

  currentRoute.current = location.pathname;

  useEffect(() => {
    const startedAtMs = Date.now();
    let ended = false;

    void recordAppEvent({
      eventName: "app_usage_session_started",
      route: currentRoute.current,
    });

    const recordSessionEnd = (reason: "page_hidden" | "tracker_unmounted") => {
      if (ended) return;
      ended = true;
      void recordAppEvent({
        eventName: "app_usage_session_ended",
        route: currentRoute.current,
        metadata: {
          reason,
          durationMs: Math.max(0, Date.now() - startedAtMs),
        },
      });
    };

    const handleVisibilityChange = () => {
      void recordAppEvent({
        eventName: "app_visibility_changed",
        route: currentRoute.current,
        metadata: {
          state: document.visibilityState,
          sessionElapsedMs: Math.max(0, Date.now() - startedAtMs),
        },
      });
    };

    const handlePageHide = () => recordSessionEnd("page_hidden");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      recordSessionEnd("tracker_unmounted");
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
