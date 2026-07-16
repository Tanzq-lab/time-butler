import { CheckCircle2, Target, TrendingUp, Zap } from "lucide-react";
import type { Session } from "@/lib/session-utils";
import { countCompletedPomos, formatPomoCount } from "@/lib/session-utils";
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
  const completedPomos = countCompletedPomos(sessions);
  const breakCount = sessions.filter(
    (session) => session.completed === 1 && session.phase !== "work",
  ).length;
  const taskCount = new Set(
    sessions
      .filter((session) => session.phase === "work" && session.completed === 1 && session.pomo_counted === 1)
      .map((session) => session.task_id)
      .filter((taskId): taskId is number => taskId !== null),
  ).size;

  const stats: StatItem[] = [
    {
      label: "完成番茄",
      value: formatPomoCount(completedPomos),
      icon: Target,
      color: "text-sahara-text",
      bg: "bg-sahara-card",
    },
    {
      label: "专注任务",
      value: `${taskCount} 个`,
      icon: CheckCircle2,
      color: "text-sahara-text-secondary",
      bg: "bg-sahara-card",
    },
    {
      label: "休息次数",
      value: `${breakCount} 次`,
      icon: TrendingUp,
      color: "text-sahara-text-secondary",
      bg: "bg-sahara-card",
    },
    {
      label: "总记录",
      value: `${sessions.length} 条`,
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
