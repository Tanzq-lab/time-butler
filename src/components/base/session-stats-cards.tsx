import { CheckCircle2, Target, TrendingUp, Zap } from "lucide-react";
import type { Session } from "@/lib/session-utils";
import { formatDuration, formatTotalTime } from "@/lib/session-utils";
import { cn } from "@/lib/cn";

interface StatItem {
  label: string;
  value: string;
  icon: typeof Target;
  color: string;
  bg: string;
}

interface SessionStatsCardsProps {
  sessions: Session[];
}

export function SessionStatsCards({ sessions }: SessionStatsCardsProps) {
  const workSessions = sessions.filter((s) => s.phase === "work");
  const totalFocusSec = workSessions.reduce(
    (acc, s) => acc + s.duration_sec,
    0,
  );
  const totalBreakSec = sessions
    .filter((s) => s.phase !== "work")
    .reduce((acc, s) => acc + s.duration_sec, 0);
  const avgSessionLength =
    workSessions.length > 0
      ? Math.round(totalFocusSec / workSessions.length)
      : 0;

  const stats: StatItem[] = [
    {
      label: "专注时长",
      value: formatTotalTime(totalFocusSec),
      icon: Target,
      color: "text-sahara-text",
      bg: "bg-sahara-card",
    },
    {
      label: "记录数",
      value: String(workSessions.length),
      icon: CheckCircle2,
      color: "text-sahara-text-secondary",
      bg: "bg-sahara-card",
    },
    {
      label: "平均时长",
      value: formatDuration(avgSessionLength),
      icon: TrendingUp,
      color: "text-sahara-text-secondary",
      bg: "bg-sahara-card",
    },
    {
      label: "休息时长",
      value: formatTotalTime(totalBreakSec),
      icon: Zap,
      color: "text-sahara-text-secondary",
      bg: "bg-sahara-card",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "group relative flex flex-col items-center rounded-[10px] border border-sahara-border bg-sahara-surface p-4 transition-[border-color,background-color] duration-150 md:p-5 lg:p-4",
            )}
          >
            <div
              className={cn(
                "mb-2.5 flex size-10 items-center justify-center rounded-md md:mb-3 md:size-12 lg:mb-2.5 lg:size-11",
                stat.bg,
              )}
            >
              <Icon aria-hidden="true" className={cn("size-5 md:size-6 lg:size-5.5", stat.color)} />
            </div>
            <p className="text-lg font-semibold tracking-tight text-sahara-text tabular-nums md:text-xl lg:text-lg">
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] font-medium text-sahara-text-secondary md:text-xs lg:text-[10px]">
              {stat.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
