import { Clock, Target, Flame, Timer } from "lucide-react";
import type { Session } from "@/lib/session-utils";
import { countCompletedPomos, formatPomoCount } from "@/lib/session-utils";
import { cn } from "@/lib/cn";

interface FocusSummaryBarProps {
  sessions: Session[];
  topCategory: { name: string; color: string; count: number } | null;
}

const ICON_STYLES = {
  clock: "bg-sahara-primary/10 text-sahara-primary",
  target: "bg-sahara-card text-sahara-text-secondary",
  flame: "bg-sahara-card text-sahara-text-secondary",
  timer: "bg-sahara-card text-sahara-text-secondary",
} as const;

function StatBox({
  label,
  value,
  icon: Icon,
  styleKey,
  extra,
  iconColor,
}: {
  label: string;
  value: React.ReactNode;
  icon: any;
  styleKey: keyof typeof ICON_STYLES;
  extra?: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-[10px] border border-sahara-border bg-sahara-surface p-3 md:p-4">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md md:size-10",
          styleKey === "flame" && iconColor ? "" : ICON_STYLES[styleKey],
        )}
        style={
          styleKey === "flame" && iconColor
            ? { backgroundColor: `${iconColor}15`, color: iconColor }
            : {}
        }
      >
        <Icon aria-hidden="true" className="size-4.5 md:size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-medium text-sahara-text-secondary">
          {label}
        </p>
        <div className="flex flex-col">
          <p className="truncate text-base font-semibold leading-tight text-sahara-text md:text-lg">
            {value}
          </p>
          {extra && <div className="mt-1">{extra}</div>}
        </div>
      </div>
    </div>
  );
}

export function FocusSummaryBar({
  sessions,
  topCategory,
}: FocusSummaryBarProps) {
  const workSessions = sessions.filter((s) => s.phase === "work");
  const completedPomos = countCompletedPomos(sessions);
  const breakCount = sessions.filter(
    (session) => session.completed === 1 && session.phase !== "work",
  ).length;
  const taskCount = new Set(
    workSessions
      .filter((session) => session.completed === 1 && session.pomo_counted === 1)
      .map((session) => session.task_id)
      .filter((taskId): taskId is number => taskId !== null),
  ).size;

  return (
    <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
      <StatBox
        label="完成番茄"
        value={formatPomoCount(completedPomos)}
        icon={Clock}
        styleKey="clock"
      />
      
      <StatBox
        label="休息次数"
        value={`${breakCount} 次`}
        icon={Target}
        styleKey="target"
      />

      <StatBox 
        label="主要专注" 
        styleKey="flame"
        icon={Flame}
        iconColor={topCategory?.color}
        value={topCategory ? topCategory.name : "—"}
        extra={topCategory && (
          <div className="flex items-center gap-1">
             <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: topCategory.color }}
              />
              <span className="text-[10px] font-medium tabular-nums text-sahara-text-secondary">
                已完成 {topCategory.count} 个番茄
              </span>
          </div>
        )}
      />

      <StatBox
        label="专注任务"
        value={`${taskCount} 个`}
        icon={Timer}
        styleKey="timer"
      />
    </div>
  );
}
