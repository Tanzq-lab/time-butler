import { useState, useEffect, useCallback } from "react";
import { Text } from "@/components/ui/text";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getTodaySessions } from "@/lib/db";
import type { Session } from "@/lib/db";
import { countCompletedPomos, formatPomoCount } from "@/lib/session-utils";
import { SessionCard } from "@/components/base/session-card";
import { SessionStatsCards } from "@/components/base/session-stats-cards";
import { TopCategoryBadge } from "@/components/base/top-category-badge";
import { SessionsEmptyState } from "@/components/base/sessions-empty-state";

export function TodaySessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await getTodaySessions();
      setSessions(data);
    } catch (err) {
      console.error("[TodaySessions] Failed to refresh:", err);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
    const interval = setInterval(refreshSessions, 10000);
    return () => clearInterval(interval);
  }, [refreshSessions]);

  const completedPomos = countCompletedPomos(sessions);

  return (
    <section className="mt-7 w-full border-t border-sahara-border pt-7 md:mt-9 md:pt-9">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        className="group mb-4 flex w-full items-center justify-between rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus md:mb-6"
      >
        <div className="flex items-center gap-2 md:gap-3">
          <Text variant="h3" className="text-lg font-semibold md:text-xl">
            今日记录
          </Text>
          {sessions.length > 0 && (
            <span className="rounded-md bg-sahara-card px-2 py-0.5 text-xs text-sahara-text-secondary">
              已完成 {formatPomoCount(completedPomos)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {sessions.length > 0 && !isCollapsed && (
            <span className="text-[10px] md:text-xs font-medium text-sahara-text-muted hidden sm:block">
              专注总计：{formatPomoCount(completedPomos)}
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown className="size-4 md:w-5 md:h-5 text-sahara-text-muted group-hover:text-sahara-text-secondary transition-colors" />
          ) : (
            <ChevronUp className="size-4 md:w-5 md:h-5 text-sahara-text-muted group-hover:text-sahara-text-secondary transition-colors" />
          )}
        </div>
      </button>

      {!isCollapsed && (
        <>
          {sessions.length === 0 ? (
            <SessionsEmptyState />
          ) : (
            <>
              <SessionStatsCards sessions={sessions} />
              <TopCategoryBadge sessions={sessions} />
              <div className="space-y-1.5 md:space-y-2">
                {[...sessions].reverse().map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
