import { Flame, Clock, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WeekSummary } from "@/lib/db";

interface CalendarWeekStatsProps {
  summary: WeekSummary;
}

function formatPomos(count: number): string {
  return `${count} 个番茄`;
}

export function CalendarWeekStats({ summary }: CalendarWeekStatsProps) {
  const stats = [
    {
      icon: Clock,
      label: "完成番茄",
      value: formatPomos(summary.completed_pomos),
      color: "text-sahara-text",
      bg: "bg-sahara-card",
    },
    {
      icon: Target,
      label: "专注 / 休息",
      value: `${summary.completed_pomos} 个 · ${summary.break_sessions} 次`,
      color: "text-sahara-text-secondary",
      bg: "bg-sahara-card",
    },
    {
      icon: Flame,
      label: "日均番茄",
      value: formatPomos(summary.avg_daily_pomos),
      color: "text-sahara-text",
      bg: "bg-sahara-card",
    },
    {
      icon: TrendingUp,
      label: "高峰日",
      value: summary.peak_day
        ? `${new Date(summary.peak_day + "T00:00:00").toLocaleDateString("zh-CN", { weekday: "short", month: "short", day: "numeric" })} (${formatPomos(summary.peak_day_pomos)})`
        : "—",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="border-b border-sahara-border bg-sahara-surface p-3"
          >
            <div
              className={cn(
                "mb-2 flex size-8 items-center justify-center rounded-md",
                stat.bg,
              )}
            >
              <Icon className={cn("size-4", stat.color)} />
            </div>
            <p className="text-[10px] text-sahara-text-muted">
              {stat.label}
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-xs font-semibold leading-tight md:text-sm",
                stat.color,
              )}
            >
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
