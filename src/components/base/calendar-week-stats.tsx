import { CalendarRange, Flame, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CalendarEvent, WeekSummary } from "@/lib/db";
import { parseLocalDateTime } from "@/lib/time";

interface CalendarWeekStatsProps {
  summary: WeekSummary;
  calendarEvents?: CalendarEvent[];
}

function formatPomos(count: number): string {
  return `${count} 个番茄`;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}小时${remainder}分钟` : `${hours} 小时`;
}

export function CalendarWeekStats({ summary, calendarEvents = [] }: CalendarWeekStatsProps) {
  const calendarEventSeconds = calendarEvents.reduce((total, event) => {
    const start = parseLocalDateTime(event.starts_at).getTime();
    const end = parseLocalDateTime(event.ends_at).getTime();
    return total + Math.max(0, Math.round((end - start) / 1000));
  }, 0);
  const stats = [
    {
      icon: Clock,
      label: "完成番茄",
      value: formatPomos(summary.completed_pomos),
      color: "text-sahara-text",
      bg: "bg-sahara-card",
    },
    {
      icon: CalendarRange,
      label: "其他时间",
      value: calendarEvents.length > 0
        ? `${calendarEvents.length} 项 · ${formatDuration(calendarEventSeconds)}`
        : "0 项",
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
              <Icon aria-hidden="true" className={cn("size-4", stat.color)} />
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
