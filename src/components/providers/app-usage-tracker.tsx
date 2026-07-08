import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { recordAppEvent } from "@/lib/db";

export function AppUsageTracker() {
  const location = useLocation();
  const previousRoute = useRef<string | null>(null);

  useEffect(() => {
    const route = location.pathname;
    void recordAppEvent({
      eventName: "route_viewed",
      route,
      metadata: {
        fromRoute: previousRoute.current,
        hasSearch: location.search.length > 0,
      },
    });
    previousRoute.current = route;
  }, [location.pathname, location.search]);

  return null;
}
