import type { CategoryBreakdown } from "@/lib/db";
import { formatPomoCount } from "@/lib/session-utils";
import { cn } from "@/lib/cn";

interface CategoryBreakdownProps {
  breakdowns: CategoryBreakdown[];
}

function isValidBreakdown(item: CategoryBreakdown): boolean {
  return (
    Number.isFinite(item.pomo_count) &&
    item.pomo_count > 0
  );
}

export function hasCategoryBreakdownData(
  breakdowns: CategoryBreakdown[],
): boolean {
  return breakdowns.some(isValidBreakdown);
}

export function CategoryBreakdown({ breakdowns }: CategoryBreakdownProps) {
  const validBreakdowns = breakdowns.filter(isValidBreakdown);

  if (validBreakdowns.length === 0) return null;

  const maxPomos = Math.max(...validBreakdowns.map((b) => b.pomo_count), 1);

  return (
    <div className="space-y-6 md:space-y-7">
      {validBreakdowns.map((item) => {
        const percentage = Math.round((item.pomo_count / maxPomos) * 100);
        const label = item.category_name || item.intention || "未分类";
        const color = item.category_color || "#94a3b8";

        return (
          <div key={`${item.category_id}-${item.intention}`} className="relative">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="size-2.5 rounded-full"
                  style={{ 
                    backgroundColor: color, 
                    boxShadow: `0 0 0 4px ${color}20` 
                  }}
                />
                <span className="text-sm md:text-base font-bold text-sahara-text truncate tracking-tight">
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 ml-4">
                <span className="text-sm font-semibold text-sahara-text-secondary tabular-nums md:text-base">
                  {formatPomoCount(item.pomo_count)}
                </span>
                <span className="hidden items-center rounded-md border border-sahara-border bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-secondary sm:inline-flex">
                  完成 {item.pomo_count} 个
                </span>
              </div>
            </div>
            
            <div className="relative h-2.5 w-full bg-sahara-bg/50 rounded-full overflow-hidden border border-sahara-border/5">
              <div
                className={cn("relative h-full rounded-full transition-[width] duration-200 ease-out")}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
