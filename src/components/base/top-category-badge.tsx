import { Flame } from "lucide-react";
import type { Session } from "@/lib/session-utils";

interface TopCategoryBadgeProps {
  sessions: Session[];
}

export function TopCategoryBadge({ sessions }: TopCategoryBadgeProps) {
  const categoryCounts = sessions.reduce(
    (acc: Record<string, number>, s: Session) => {
      if (s.phase === "work" && s.completed === 1 && s.pomo_counted === 1 && s.intention) {
        acc[s.intention] = (acc[s.intention] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const topCategory = Object.entries(categoryCounts).reduce(
    (max, entry) => (entry[1] > (max?.[1] ?? -1) ? entry : max),
    null as [string, number] | null,
  );

  if (!topCategory) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[10px] border border-sahara-border bg-sahara-surface px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sahara-card">
        <Flame aria-hidden="true" className="size-4 text-sahara-text-secondary" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
        <span className="text-xs font-medium text-sahara-text-secondary md:text-sm">
          今日重点：
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-sahara-card px-2.5 py-1 text-[11px] font-semibold text-sahara-text md:text-xs">
            {topCategory[0]}
          </span>
          <span className="text-[11px] font-medium text-sahara-text-secondary tabular-nums md:text-xs">
            今天已完成 {topCategory[1]} 个番茄
          </span>
        </div>
      </div>
    </div>
  );
}
