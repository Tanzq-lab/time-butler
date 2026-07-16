import { Clock, CheckCircle2, Tag } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { WeekSession } from "@/lib/db";
import { formatTimeAmPm, parseLocalDateTime } from "@/lib/time";

interface CalendarSessionBlockProps {
  session: WeekSession;
  topPx: number;
  heightPx: number;
  compact?: boolean;
  onEditPomo?: (session: WeekSession) => void;
}

function getTimeRange(session: WeekSession): string {
  const start = parseLocalDateTime(session.started_at);
  const end = new Date(start.getTime() + session.duration_sec * 1000);
  return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
}

const DEFAULT_WORK_COLOR = "#687B84";
const WORK_CARD_CLASS = "calendar-work-session";
const WORK_MUTED_CLASS = "calendar-work-session__muted";
const WORK_CATEGORY_CLASS = "calendar-work-session__category";
const BREAK_CARD_CLASS = "calendar-break-session";
const BREAK_MUTED_CLASS = "calendar-break-session__muted";

function getCardStyle(
  topPx: number,
  heightPx: number,
  isWork: boolean,
  workColor: string,
): CSSProperties {
  // The one-pixel inset lets adjacent sessions breathe while preserving their
  // true position and duration on the time scale.
  const hasBreathingRoom = isWork && heightPx >= 24;
  return {
    top: topPx + (hasBreathingRoom ? 1 : 0),
    height: hasBreathingRoom ? heightPx - 2 : heightPx,
    ...(isWork && { "--calendar-session-color": workColor }),
  } as CSSProperties;
}

export function CalendarSessionBlock({
  session,
  topPx,
  heightPx,
  compact = false,
  onEditPomo,
}: CalendarSessionBlockProps) {
  const isWork = session.phase === "work";
  const isBreak = !isWork;

  const title = isWork
    ? session.task_name || session.intention || ""
    : session.intention || "";
  const timeRange = getTimeRange(session);
  const phaseLabel =
    isWork ? "专注" : session.phase === "long_break" ? "长休息" : "短休息";
  const workColor = session.category_color || DEFAULT_WORK_COLOR;
  const cardStyle = getCardStyle(topPx, heightPx, isWork, workColor);
  const isMicro = Number(cardStyle.height) < 22;
  const canEditPomo =
    isWork &&
    session.completed === 1 &&
    session.pomo_counted === 1 &&
    session.task_id !== null &&
    onEditPomo;
  const interactionClass = canEditPomo
    ? "cursor-pointer text-left outline-none transition-[filter,box-shadow] hover:brightness-[0.96] focus-visible:ring-2 focus-visible:ring-sahara-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-bg"
    : "";
  const accessibleLabel = canEditPomo
    ? `更正番茄归属：${title || "未命名任务"} ${timeRange}`
    : `${phaseLabel}${title ? ` ${title}` : ""} ${timeRange}`;

  if (compact) {
    if (canEditPomo) {
      return (
        <button
          type="button"
          className={cn(
            "absolute left-1 right-1 z-10 overflow-hidden border md:left-1.5 md:right-1.5",
            isMicro
              ? "rounded-[4px]"
              : "rounded-md md:rounded-lg px-1.5 md:px-2 py-0.5",
            isWork ? WORK_CARD_CLASS : BREAK_CARD_CLASS,
            interactionClass,
          )}
          style={cardStyle}
          title={`点击更正归属 · ${phaseLabel}${title ? ` · ${title}` : ""} · ${timeRange}`}
          aria-label={accessibleLabel}
          onClick={() => onEditPomo(session)}
        >
          {!isMicro && (
            <div className="flex h-full min-w-0 items-center">
              {title && (
                <span
                  className="min-w-0 truncate text-[10px] font-medium leading-none"
                >
                  {title}
                </span>
              )}
            </div>
          )}
        </button>
      );
    }

    return (
      <div
        role="group"
        className={cn(
          "absolute left-1 right-1 z-10 overflow-hidden border md:left-1.5 md:right-1.5",
          isMicro
            ? "rounded-[4px]"
            : "rounded-md md:rounded-lg px-1.5 md:px-2 py-0.5",
            isWork ? WORK_CARD_CLASS : BREAK_CARD_CLASS,
          )}
        style={cardStyle}
        title={`${phaseLabel}${title ? ` · ${title}` : ""} · ${timeRange}`}
        aria-label={accessibleLabel}
      >
        {!isMicro && (
          <div className="flex h-full min-w-0 items-center gap-1.5">
            {isBreak && (
              <span className={cn("shrink-0 text-[10px] font-bold leading-none", BREAK_MUTED_CLASS)}>
                {phaseLabel}
              </span>
            )}
            {title && (
              <span
                className={cn(
                  "min-w-0 truncate text-[10px] font-medium leading-none",
                  isWork ? undefined : "calendar-break-session__title",
                )}
              >
                {title}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (canEditPomo) {
    return (
      <button
        type="button"
        aria-label={accessibleLabel}
        className={cn(
          "absolute left-1 right-1 z-10 flex flex-col overflow-hidden rounded-md border px-2.5 py-1.5 md:left-1.5 md:right-1.5 md:rounded-[10px] md:px-3 md:py-2.5",
          isWork ? WORK_CARD_CLASS : BREAK_CARD_CLASS,
          interactionClass,
        )}
        style={cardStyle}
        title={`点击更正归属 · ${phaseLabel}${title ? ` · ${title}` : ""} · ${timeRange}`}
        onClick={() => onEditPomo(session)}
      >
        {title && (
          <div className="flex items-start justify-between gap-1 md:gap-1 mb-0.5">
            <span
              className="font-semibold text-[11px] leading-tight line-clamp-2 md:text-[13px]"
            >
              {title}
            </span>
            <CheckCircle2
              aria-hidden="true"
              className={cn("mt-0.5 size-3 shrink-0 md:size-4", WORK_MUTED_CLASS)}
            />
          </div>
        )}
        {session.category_name && (
          <div className="mb-0.5 md:mb-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold md:text-[10px]",
                WORK_CATEGORY_CLASS,
              )}
            >
              {session.category_name}
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center gap-1 pt-0.5 md:gap-1.5 md:pt-1">
          <Clock aria-hidden="true" className={cn("size-2.5 md:size-3", WORK_MUTED_CLASS)} />
          <span className={cn("text-[9px] font-medium tabular-nums tracking-wide md:text-[10px]", WORK_MUTED_CLASS)}>
            {timeRange}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={accessibleLabel}
      className={cn(
        "absolute left-1 right-1 z-10 flex flex-col overflow-hidden rounded-md border px-2.5 py-1.5 md:left-1.5 md:right-1.5 md:rounded-[10px] md:px-3 md:py-2.5",
        isWork ? WORK_CARD_CLASS : BREAK_CARD_CLASS,
      )}
      style={cardStyle}
    >
      {isBreak && (
        <div className={cn("mb-0.5 text-[12px] font-bold leading-tight md:text-sm", BREAK_MUTED_CLASS)}>
          {phaseLabel}
        </div>
      )}

      {/* Title / Task Name */}
      {title && (
        <div className="flex items-start justify-between gap-1 md:gap-1 mb-0.5">
          <span
            className={cn(
              "font-semibold text-[11px] md:text-[13px] leading-tight line-clamp-2",
              isWork ? undefined : "calendar-break-session__title",
            )}
          >
            {title}
          </span>
          {isWork && (
            <CheckCircle2
              aria-hidden="true"
              className={cn("mt-0.5 size-3 shrink-0 md:size-4", WORK_MUTED_CLASS)}
            />
          )}
        </div>
      )}

      {isWork && session.category_name && (
        <div className="mb-0.5 md:mb-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold md:text-[10px]",
              WORK_CATEGORY_CLASS,
            )}
          >
            {session.category_name}
          </span>
        </div>
      )}

      {/* Time Range */}
      <div className="flex items-center gap-1 md:gap-1.5 mt-auto pt-0.5 md:pt-1">
        {isBreak ? (
          <Tag aria-hidden="true" className={cn("size-2.5 md:size-3", BREAK_MUTED_CLASS)} />
        ) : (
          <Clock aria-hidden="true" className={cn("size-2.5 md:size-3", WORK_MUTED_CLASS)} />
        )}
        <span
          className={cn(
            "text-[9px] md:text-[10px] font-medium tabular-nums tracking-wide",
            isWork ? WORK_MUTED_CLASS : BREAK_MUTED_CLASS,
          )}
        >
          {timeRange}
        </span>
      </div>
    </div>
  );
}
