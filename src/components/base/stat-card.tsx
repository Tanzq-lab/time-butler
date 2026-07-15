import { Clock, Target, TrendingUp, Flame } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: "clock" | "target" | "trending" | "flame";
}

const ICON_MAP = {
  clock: Clock,
  target: Target,
  trending: TrendingUp,
  flame: Flame,
} as const;

export function StatCard({ label, value, icon }: StatCardProps) {
  const Icon = ICON_MAP[icon];
  return (
    <div className="flex items-center gap-2.5 border-b border-sahara-border bg-sahara-surface p-3 md:gap-3 md:p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sahara-card md:size-10">
        <Icon className="size-4 text-sahara-text-secondary md:size-5" />
      </div>
      <div>
        <p className="text-[10px] text-sahara-text-muted md:text-xs">
          {label}
        </p>
        <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-sahara-text md:text-lg">
          {value}
        </p>
      </div>
    </div>
  );
}
