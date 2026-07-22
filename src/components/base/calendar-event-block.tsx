import { CalendarRange, Clock3 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/db";
import { formatTimeAmPm, parseLocalDateTime } from "@/lib/time";

interface CalendarEventBlockProps {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
  compact?: boolean;
  onEdit: (event: CalendarEvent) => void;
}

function getTimeRange(event: CalendarEvent): string {
  return `${formatTimeAmPm(parseLocalDateTime(event.starts_at))} – ${formatTimeAmPm(parseLocalDateTime(event.ends_at))}`;
}

export function CalendarEventBlock({
  event,
  topPx,
  heightPx,
  compact = false,
  onEdit,
}: CalendarEventBlockProps) {
  const hasBreathingRoom = heightPx >= 24;
  const style = {
    top: topPx + (hasBreathingRoom ? 1 : 0),
    height: hasBreathingRoom ? heightPx - 2 : heightPx,
  };
  const timeRange = getTimeRange(event);
  const isMicro = Number(style.height) < 22;
  const accessibleLabel = `编辑时间：${event.title}，${timeRange}`;

  if (compact) {
    return (
      <button
        type="button"
        data-calendar-entry="event"
        aria-label={accessibleLabel}
        title={`${event.title} · ${timeRange}`}
        onClick={() => onEdit(event)}
        className={cn(
          "calendar-event absolute left-1 right-1 z-[15] overflow-hidden border text-left outline-none transition-[filter,box-shadow] hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-sahara-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-bg md:left-1.5 md:right-1.5",
          isMicro ? "rounded-[4px]" : "rounded-md px-1.5 py-0.5 md:px-2",
        )}
        style={style}
      >
        {!isMicro && (
          <div className="flex h-full min-w-0 items-center gap-1.5">
            <CalendarRange className="calendar-event__muted size-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate text-[10px] font-semibold leading-none">{event.title}</span>
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-calendar-entry="event"
      aria-label={accessibleLabel}
      title={`点击编辑 · ${event.title} · ${timeRange}`}
      onClick={() => onEdit(event)}
      className="calendar-event absolute left-1 right-1 z-[15] flex flex-col overflow-hidden rounded-md border px-2.5 py-1.5 text-left outline-none transition-[filter,box-shadow] hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-sahara-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-bg md:left-1.5 md:right-1.5 md:rounded-[10px] md:px-3 md:py-2.5"
      style={style}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <CalendarRange className="calendar-event__muted mt-0.5 size-3 shrink-0 md:size-3.5" aria-hidden="true" />
        <span className="line-clamp-2 min-w-0 text-[11px] font-semibold leading-tight md:text-[13px]">
          {event.title}
        </span>
      </div>
      {event.notes && heightPx >= 82 && (
        <p className="calendar-event__muted mt-1 line-clamp-2 text-[9px] leading-tight md:text-[10px]">
          {event.notes}
        </p>
      )}
      <div className="calendar-event__muted mt-auto flex items-center gap-1 pt-1">
        <Clock3 className="size-2.5 md:size-3" aria-hidden="true" />
        <span className="font-mono text-[9px] font-medium tabular-nums tracking-wide md:text-[10px]">
          {timeRange}
        </span>
      </div>
    </button>
  );
}
