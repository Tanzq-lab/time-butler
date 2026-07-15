import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

interface CalendarDayPillProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function CalendarDayPill({
  date,
  isSelected,
  isToday,
  onClick,
}: CalendarDayPillProps) {
  const dayOfWeek = date.getDay();

  return (
    <Button
      variant={isSelected ? "outline" : "ghost"}
      intent={isSelected || isToday ? "sahara" : "default"}
      size="icon-lg"
      shape="rounded-xl"
      fullWidth
      onClick={onClick}
      className={cn(
        "flex-col gap-0.5 py-2 h-auto",
        !isSelected && !isToday && "text-sahara-text-secondary",
        isSelected && "border-sahara-text-muted bg-sahara-card text-sahara-text",
        isToday && !isSelected && "text-sahara-primary font-semibold",
      )}
    >
      <span
        className={cn(
          "text-[9px] font-semibold leading-none",
          isSelected ? "text-sahara-text-secondary" : "",
        )}
      >
        {DAY_LABELS[dayOfWeek]}
      </span>
      <span
        className={cn(
          "font-mono text-base font-bold leading-none",
          isSelected ? "text-sahara-text" : "",
        )}
      >
        {date.getDate()}
      </span>
    </Button>
  );
}
