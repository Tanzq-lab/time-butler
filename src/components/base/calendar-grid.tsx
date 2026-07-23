import { useMemo, useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import type { CalendarEvent, WeekSession } from "@/lib/db";
import { formatTimeAmPm, parseLocalDateTime } from "@/lib/time";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import type { CalendarEventRange } from "./calendar-event-editor";
import { CalendarEventBlock } from "./calendar-event-block";
import { CalendarSessionBlock } from "./calendar-session-block";

interface CalendarGridProps {
  sessions: WeekSession[];
  events: CalendarEvent[];
  weekDays: Date[];
  startHour: number;
  endHour: number;
  hourHeight: number;
  onEditPomo?: (session: WeekSession) => void;
  onCreateEvent?: (range: CalendarEventRange) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const DAY_LABELS_FULL = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const MIN_LABELED_IDLE_GAP_MINUTES = 15;

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildSessionsByDay(
  sessions: WeekSession[],
): Map<string, WeekSession[]> {
  const map = new Map<string, WeekSession[]>();
  for (const s of sessions) {
    const key = toDateString(parseLocalDateTime(s.started_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

function buildEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateString(parseLocalDateTime(event.starts_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return map;
}

interface PositionedSession {
  session: WeekSession;
  topPx: number;
  heightPx: number;
  compact: boolean;
}

interface PositionedCalendarEvent {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
  compact: boolean;
}

interface IdleGap {
  id: string;
  start: Date;
  end: Date;
  topPx: number;
  heightPx: number;
  durationMin: number;
}

interface DayLayout {
  positioned: PositionedSession[];
  positionedEvents: PositionedCalendarEvent[];
  idleGaps: IdleGap[];
  hourTopPx: number[];
  totalHeight: number;
}

function getMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function formatGapDuration(durationMin: number): string {
  const rounded = Math.round(durationMin);
  if (rounded < 60) return `${rounded}分钟`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
}

export function formatTimeAtCalendarPosition(
  topPx: number,
  startHour: number,
  hourHeight: number,
): string {
  const elapsedMinutes = Math.max(0, Math.round((topPx / hourHeight) * 60));
  const totalMinutes = startHour * 60 + elapsedMinutes;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export interface CalendarSelectionPosition {
  topPx: number;
  heightPx: number;
  startMinutes: number;
  endMinutes: number;
}

export function getCalendarSelectionPosition(
  anchorPx: number,
  currentPx: number,
  totalHeight: number,
  startHour: number,
  hourHeight: number,
  minimumMinutes = 15,
): CalendarSelectionPosition {
  const snapMinutes = 15;
  const snapPx = (snapMinutes / 60) * hourHeight;
  const minimumPx = (Math.max(minimumMinutes, snapMinutes) / 60) * hourHeight;
  const clamp = (value: number) => Math.max(0, Math.min(totalHeight, value));
  const snap = (value: number) => clamp(Math.round(value / snapPx) * snapPx);
  let topPx = Math.min(snap(anchorPx), snap(currentPx));
  let bottomPx = Math.max(snap(anchorPx), snap(currentPx));

  if (bottomPx - topPx < minimumPx) {
    if (topPx + minimumPx <= totalHeight) {
      bottomPx = topPx + minimumPx;
    } else {
      topPx = Math.max(0, bottomPx - minimumPx);
    }
  }

  const startMinutes = startHour * 60 + Math.round((topPx / hourHeight) * 60);
  const endMinutes = startHour * 60 + Math.round((bottomPx / hourHeight) * 60);
  return { topPx, heightPx: bottomPx - topPx, startMinutes, endMinutes };
}

function toCalendarDateTime(day: Date, totalMinutes: number): string {
  const date = new Date(day);
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return `${toDateString(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

function CalendarIdleGap({ gap }: { gap: IdleGap }) {
  const label = `空闲 ${formatGapDuration(gap.durationMin)}`;
  const timeRange = `${formatTimeAmPm(gap.start)} - ${formatTimeAmPm(gap.end)}`;

  return (
    <div
      className="absolute left-1 right-1 md:left-1.5 md:right-1.5 z-0 pointer-events-none overflow-hidden border-y border-dashed border-sahara-border/30 bg-sahara-bg/35 text-sahara-text-muted"
      style={{ top: gap.topPx, height: gap.heightPx }}
      title={`${label} ${timeRange}`}
      aria-label={`${label} ${timeRange}`}
    >
      {gap.heightPx >= 18 && (
        <div className="flex h-full items-center justify-center px-2">
          <span className="truncate text-[10px] font-medium tabular-nums">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

export function computeDayLayout(
  daySessions: WeekSession[],
  startHour: number,
  endHour: number,
  hourHeight: number,
  dayEvents: CalendarEvent[] = [],
): DayLayout {
  const hourCount = endHour - startHour + 1;
  const totalVisibleMinutes = hourCount * 60;
  const totalHeight = hourCount * hourHeight;
  const sortedSessions = daySessions.toSorted(
    (a, b) =>
      parseLocalDateTime(a.started_at).getTime() -
      parseLocalDateTime(b.started_at).getTime(),
  );

  const positioned: PositionedSession[] = [];
  const positionedEvents: PositionedCalendarEvent[] = [];
  const occupiedIntervals: Array<{
    startMin: number;
    endMin: number;
    startTime: Date;
    endTime: Date;
  }> = [];

  for (const session of sortedSessions) {
    if (session.duration_sec <= 0) continue;

    const startTime = parseLocalDateTime(session.started_at);
    const endTime = new Date(startTime.getTime() + session.duration_sec * 1000);
    const startMin = getMinutesSinceMidnight(startTime) - startHour * 60;
    const endMin = startMin + session.duration_sec / 60;
    const visibleStartMin = Math.max(startMin, 0);
    const visibleEndMin = Math.min(endMin, totalVisibleMinutes);

    if (visibleEndMin <= 0 || visibleStartMin >= totalVisibleMinutes) {
      continue;
    }

    if (visibleEndMin <= visibleStartMin) {
      continue;
    }

    const topPx = (visibleStartMin / 60) * hourHeight;
    const heightPx = ((visibleEndMin - visibleStartMin) / 60) * hourHeight;

    positioned.push({
      session,
      topPx,
      heightPx,
      compact: heightPx < 48,
    });

    occupiedIntervals.push({
      startMin: visibleStartMin,
      endMin: visibleEndMin,
      startTime: new Date(startTime.getTime() + Math.max(0, -startMin) * 60_000),
      endTime: new Date(endTime.getTime() - Math.max(0, endMin - totalVisibleMinutes) * 60_000),
    });
  }

  for (const event of dayEvents.toSorted(
    (a, b) => parseLocalDateTime(a.starts_at).getTime() - parseLocalDateTime(b.starts_at).getTime(),
  )) {
    const startTime = parseLocalDateTime(event.starts_at);
    const endTime = parseLocalDateTime(event.ends_at);
    const startMin = getMinutesSinceMidnight(startTime) - startHour * 60;
    const endMin = getMinutesSinceMidnight(endTime) - startHour * 60;
    const visibleStartMin = Math.max(startMin, 0);
    const visibleEndMin = Math.min(endMin, totalVisibleMinutes);

    if (visibleEndMin <= visibleStartMin) continue;

    const topPx = (visibleStartMin / 60) * hourHeight;
    const heightPx = ((visibleEndMin - visibleStartMin) / 60) * hourHeight;
    positionedEvents.push({
      event,
      topPx,
      heightPx,
      compact: heightPx < 48,
    });
    occupiedIntervals.push({
      startMin: visibleStartMin,
      endMin: visibleEndMin,
      startTime: new Date(startTime.getTime() + Math.max(0, -startMin) * 60_000),
      endTime: new Date(endTime.getTime() - Math.max(0, endMin - totalVisibleMinutes) * 60_000),
    });
  }

  const idleGaps: IdleGap[] = [];
  const sortedIntervals = occupiedIntervals.toSorted((a, b) => a.startMin - b.startMin);
  let previousInterval: (typeof sortedIntervals)[number] | null = null;

  for (const interval of sortedIntervals) {
    if (!previousInterval) {
      previousInterval = interval;
      continue;
    }

    const gapMin = interval.startMin - previousInterval.endMin;
    if (gapMin >= MIN_LABELED_IDLE_GAP_MINUTES) {
      idleGaps.push({
        id: `${previousInterval.endTime.toISOString()}-${interval.startTime.toISOString()}`,
        start: previousInterval.endTime,
        end: interval.startTime,
        topPx: (previousInterval.endMin / 60) * hourHeight,
        heightPx: (gapMin / 60) * hourHeight,
        durationMin: gapMin,
      });
    }

    if (interval.endMin > previousInterval.endMin) {
      previousInterval = {
        ...interval,
        startMin: previousInterval.startMin,
        startTime: previousInterval.startTime,
      };
    }
  }

  const hourTopPx = Array.from(
    { length: hourCount + 1 },
    (_, idx) => idx * hourHeight,
  );

  return {
    positioned,
    positionedEvents,
    idleGaps,
    hourTopPx,
    totalHeight,
  };
}

interface CalendarMobileViewProps {
  scrollMemoryKey: string;
  weekDays: Date[];
  allDayLayouts: DayLayout[];
  hours: number[];
  formatHour: (h: number) => string;
  currentTimePos: number | null;
  sessions: WeekSession[];
  events: CalendarEvent[];
  onEditPomo?: (session: WeekSession) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

function CalendarMobileView({
  scrollMemoryKey, weekDays, allDayLayouts, hours, formatHour, currentTimePos, sessions, events, onEditPomo, onEditEvent,
}: CalendarMobileViewProps) {
  const scrollRef = useScrollMemory<HTMLDivElement>(scrollMemoryKey);
  const todayIdx = weekDays.findIndex(isToday);
  const totalHeight = Math.max(...allDayLayouts.map((layout) => layout.totalHeight));
  const gridTemplateColumns = `48px repeat(${weekDays.length}, 9rem)`;

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || todayIdx < 0) return;

    const dayWidth = 144;
    const targetLeft = 48 + todayIdx * dayWidth - (viewport.clientWidth - dayWidth) / 2;
    viewport.scrollLeft = Math.max(0, targetLeft);
  }, [todayIdx, weekDays]);

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="日历时间轴"
      tabIndex={0}
      className="relative h-[min(40rem,calc(100dvh-14rem))] min-h-[30rem] flex-1 overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sahara-focus md:hidden"
    >
      <div className="relative w-max min-w-full">
        <div
          className="sticky top-0 z-20 grid border-b border-sahara-border bg-sahara-surface"
          style={{ gridTemplateColumns }}
        >
          <div className="sticky left-0 z-30 border-r border-sahara-border bg-sahara-surface" />
          {weekDays.map((day) => {
            const dayIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
            const today = isToday(day);
            return (
              <div
                key={day.toDateString()}
                data-today={today || undefined}
                className={cn(
                  "relative border-r border-sahara-border px-2 py-2.5 text-center last:border-r-0",
                  today && "bg-sahara-card",
                )}
              >
                <span className="block text-[10px] font-medium text-sahara-text-secondary">
                  {DAY_LABELS_FULL[dayIdx]}
                </span>
                <span className="mt-0.5 block font-mono text-base font-medium text-sahara-text">
                  {day.getDate()}
                </span>
                {today && <div className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-sahara-primary" />}
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns, minHeight: totalHeight }}>
          <div className="sticky left-0 z-10 border-r border-sahara-border bg-sahara-card">
            {hours.map((hour, hIdx) => {
              const maxH = Math.max(
                ...allDayLayouts.map((layout) => layout.hourTopPx[hIdx + 1] - layout.hourTopPx[hIdx]),
              );
              return (
                <div key={hour} className="border-b border-sahara-border/15 pr-2 text-right" style={{ height: maxH }}>
                  <span className="mt-2 inline-block font-mono text-[10px] leading-none text-sahara-text-secondary">
                    {formatHour(hour)}
                  </span>
                </div>
              );
            })}
          </div>

          {weekDays.map((day, idx) => {
            const layout = allDayLayouts[idx];
            const today = isToday(day);
            return (
              <div
                key={day.toDateString()}
                className={cn(
                  "relative border-r border-sahara-border last:border-r-0",
                  today && "bg-sahara-card/70",
                )}
                style={{ minHeight: totalHeight }}
              >
                {hours.map((_, hIdx) => (
                  <div
                    key={hIdx}
                    className="border-b border-sahara-border/10"
                    style={{ height: layout.hourTopPx[hIdx + 1] - layout.hourTopPx[hIdx] }}
                  />
                ))}
                {layout.idleGaps.map((gap) => (
                  <CalendarIdleGap key={gap.id} gap={gap} />
                ))}
                {layout.positioned.map(({ session, topPx, heightPx, compact }) => (
                  <CalendarSessionBlock
                    key={session.id}
                    session={session}
                    topPx={topPx}
                    heightPx={heightPx}
                    compact={compact}
                    onEditPomo={onEditPomo}
                  />
                ))}
                {onEditEvent && layout.positionedEvents.map(({ event, topPx, heightPx, compact }) => (
                  <CalendarEventBlock
                    key={event.id}
                    event={event}
                    topPx={topPx}
                    heightPx={heightPx}
                    compact={compact}
                    onEdit={onEditEvent}
                  />
                ))}
                {currentTimePos !== null && today && (
                  <div className="pointer-events-none absolute left-0 right-0 z-30 flex items-center" style={{ top: currentTimePos }}>
                    <div className="-ml-1 size-1.5 rounded-full bg-sahara-primary" />
                    <div className="flex-1 border-t border-sahara-primary/50" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && events.length === 0 && (
          <div className="pointer-events-none sticky bottom-6 left-14 w-[calc(100vw-6rem)] rounded-md bg-sahara-surface/90 px-4 py-3 text-center text-xs text-sahara-text-secondary">
            本周还没有记录，可用“添加时间”说明会议等时间去向
          </div>
        )}
      </div>
    </div>
  );
}

interface CalendarDesktopViewProps {
  scrollMemoryKey: string;
  weekDays: Date[];
  allDayLayouts: DayLayout[];
  hours: number[];
  formatHour: (h: number) => string;
  currentTimePos: number | null;
  todayIdx: number;
  desktopGridTotalHeight: number;
  sessions: WeekSession[];
  events: CalendarEvent[];
  onEditPomo?: (session: WeekSession) => void;
  onCreateEvent?: (range: CalendarEventRange) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  startHour: number;
  hourHeight: number;
}

function CalendarDesktopView({
  scrollMemoryKey, weekDays, allDayLayouts, hours, formatHour,
  currentTimePos, todayIdx, desktopGridTotalHeight, sessions, events, onEditPomo,
  onCreateEvent, onEditEvent, startHour, hourHeight,
}: CalendarDesktopViewProps) {
  const scrollRef = useScrollMemory<HTMLDivElement>(scrollMemoryKey);
  const [hoverTimePosition, setHoverTimePosition] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const [dragSelection, setDragSelection] = useState<{
    dayIndex: number;
    anchorPx: number;
    currentPx: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  const updateHoverTime = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || draggingRef.current) return;

    const timeline = event.currentTarget;
    const bounds = timeline.getBoundingClientRect();
    const position = Math.max(
      0,
      Math.min(
        desktopGridTotalHeight,
        event.clientY - bounds.top + timeline.scrollTop,
      ),
    );
    setHoverTimePosition(position);
  };

  const getPointerPosition = (event: ReactPointerEvent<HTMLDivElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(desktopGridTotalHeight, event.clientY - bounds.top));
  };

  const startSelecting = (dayIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onCreateEvent || event.pointerType === "touch" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-calendar-entry]")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const position = getPointerPosition(event);
    draggingRef.current = true;
    setHoverTimePosition(null);
    setDragSelection({
      dayIndex,
      anchorPx: position,
      currentPx: position,
      pointerId: event.pointerId,
      moved: false,
    });
  };

  const continueSelecting = (dayIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    const position = getPointerPosition(event);
    setDragSelection((current) => {
      if (!current || current.dayIndex !== dayIndex || current.pointerId !== event.pointerId) return current;
      return {
        ...current,
        currentPx: position,
        moved: current.moved || Math.abs(position - current.anchorPx) >= 4,
      };
    });
  };

  const finishSelecting = (dayIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragSelection || dragSelection.dayIndex !== dayIndex || !onCreateEvent) return;
    const position = getPointerPosition(event);
    const moved = dragSelection.moved || Math.abs(position - dragSelection.anchorPx) >= 4;
    const selection = getCalendarSelectionPosition(
      dragSelection.anchorPx,
      position,
      desktopGridTotalHeight,
      startHour,
      hourHeight,
      moved ? 15 : 30,
    );
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    draggingRef.current = false;
    setDragSelection(null);
    onCreateEvent({
      startsAt: toCalendarDateTime(weekDays[dayIndex], selection.startMinutes),
      endsAt: toCalendarDateTime(weekDays[dayIndex], selection.endMinutes),
    });
  };

  return (
    <div className="hidden flex-col md:flex">
      <div className="sticky top-0 z-20 grid border-b border-sahara-border bg-sahara-surface" style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}>
        <div className="sticky left-0 z-30 border-r border-sahara-border bg-sahara-surface p-4" />
        {weekDays.map((day) => {
          const dayIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
          const today = isToday(day);
          return (
            <div key={day.toDateString()} className={cn("relative border-r border-sahara-border px-2 pb-2 pt-3 text-center last:border-r-0", today && "bg-sahara-card")}>
              <span className={cn("mb-0.5 block text-[10px] font-medium", today ? "text-sahara-text" : "text-sahara-text-muted")}>{DAY_LABELS_FULL[dayIdx]}</span>
              <p className={cn("font-mono text-xl leading-none", today ? "font-semibold text-sahara-text" : "text-sahara-text")}>{day.getDate()}</p>
              {today && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-sahara-primary" />}
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        role="region"
        aria-label="日历时间轴"
        tabIndex={0}
        data-testid="calendar-desktop-timeline"
        onPointerMove={updateHoverTime}
        onPointerLeave={() => setHoverTimePosition(null)}
        className="relative h-[min(48rem,calc(100dvh-13rem))] min-h-[26rem] overflow-y-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sahara-focus"
      >
        <div className="relative grid" style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)`, minHeight: desktopGridTotalHeight }}>
          <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-sahara-border bg-sahara-card">
            {hours.map((hour, hIdx) => {
              const maxH = Math.max(
                ...allDayLayouts.map((l) => l.hourTopPx[hIdx + 1] - l.hourTopPx[hIdx]),
              );
              return (
                <div key={hour} className="pr-3 text-right border-b border-sahara-border/15" style={{ height: maxH }}>
                  <span className="text-[11px] font-medium text-sahara-text-muted tabular-nums leading-none inline-block mt-2">{formatHour(hour)}</span>
                </div>
              );
            })}
          </div>

          {weekDays.map((day, idx) => {
            const layout = allDayLayouts[idx];
            const today = isToday(day);
            return (
              <div
                key={day.toDateString()}
                data-testid={`calendar-day-${toDateString(day)}`}
                aria-label={`${DAY_LABELS_FULL[idx]} ${day.getMonth() + 1}月${day.getDate()}日，拖动空白时段添加时间`}
                onPointerDown={(event) => startSelecting(idx, event)}
                onPointerMove={(event) => continueSelecting(idx, event)}
                onPointerUp={(event) => finishSelecting(idx, event)}
                onPointerCancel={() => {
                  draggingRef.current = false;
                  setDragSelection(null);
                }}
                className={cn(
                  "relative border-r border-sahara-border last:border-r-0",
                  today && "bg-sahara-card/70",
                  onCreateEvent && "cursor-crosshair select-none",
                )}
                style={{ minHeight: desktopGridTotalHeight }}
              >
                {hours.map((_, hIdx) => (
                  <div key={hIdx} className="border-b border-sahara-border/10" style={{ height: layout.hourTopPx[hIdx + 1] - layout.hourTopPx[hIdx] }} />
                ))}
                {layout.idleGaps.map((gap) => (
                  <CalendarIdleGap key={gap.id} gap={gap} />
                ))}
                {layout.positioned.map(({ session, topPx, heightPx, compact }) => (
                  <CalendarSessionBlock key={session.id} session={session} topPx={topPx} heightPx={heightPx} compact={compact} onEditPomo={onEditPomo} />
                ))}
                {onEditEvent && layout.positionedEvents.map(({ event, topPx, heightPx, compact }) => (
                  <CalendarEventBlock key={event.id} event={event} topPx={topPx} heightPx={heightPx} compact={compact} onEdit={onEditEvent} />
                ))}
                {dragSelection?.dayIndex === idx && (() => {
                  const selection = getCalendarSelectionPosition(
                    dragSelection.anchorPx,
                    dragSelection.currentPx,
                    desktopGridTotalHeight,
                    startHour,
                    hourHeight,
                    dragSelection.moved ? 15 : 30,
                  );
                  const timeRange = `${formatTimeAtCalendarPosition(selection.topPx, startHour, hourHeight)} – ${formatTimeAtCalendarPosition(selection.topPx + selection.heightPx, startHour, hourHeight)}`;
                  return (
                    <div
                      role="status"
                      aria-label={`已选择 ${timeRange}`}
                      className="calendar-event-selection pointer-events-none absolute left-1 right-1 z-20 overflow-hidden rounded-md border px-2 py-1.5 md:left-1.5 md:right-1.5"
                      style={{ top: selection.topPx + 1, height: Math.max(1, selection.heightPx - 2) }}
                    >
                      <span className="block truncate font-mono text-[10px] font-semibold tabular-nums">
                        {timeRange}
                      </span>
                      {selection.heightPx >= 42 && (
                        <span className="calendar-event-selection__hint mt-1 block truncate text-[10px] font-medium">
                          松开后填写内容
                        </span>
                      )}
                    </div>
                  );
                })()}
                {currentTimePos !== null && idx === todayIdx && (
                  <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: currentTimePos }}>
                    <div className="-ml-1 size-1.5 rounded-full bg-sahara-primary" />
                    <div className="flex-1 border-t border-sahara-primary/40" />
                  </div>
                )}
              </div>
            );
          })}

          {hoverTimePosition !== null && (
            <div
              data-testid="calendar-hover-time-ruler"
              aria-label={`悬浮时间 ${formatTimeAtCalendarPosition(hoverTimePosition, startHour, hourHeight)}`}
              className="pointer-events-none absolute inset-x-0 z-40 h-px"
              style={{ top: hoverTimePosition }}
            >
              <div className="absolute left-16 right-0 border-t border-sahara-text-secondary/35" />
              <span className="absolute -top-3 left-1 w-14 rounded-sm border border-sahara-border bg-sahara-surface/95 px-1 py-0.5 text-center font-mono text-[10px] font-medium tabular-nums text-sahara-text-secondary shadow-sm">
                {formatTimeAtCalendarPosition(hoverTimePosition, startHour, hourHeight)}
              </span>
            </div>
          )}
        </div>

        {sessions.length === 0 && events.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center opacity-30">
              <p className="text-xs font-medium text-sahara-text-secondary">本周还没有记录</p>
              <p className="text-[11px] text-sahara-text-muted mt-1">拖动空白时段添加会议等时间</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  sessions,
  events,
  weekDays,
  startHour,
  endHour,
  hourHeight,
  onEditPomo,
  onCreateEvent,
  onEditEvent,
}: CalendarGridProps) {
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  );

  function formatHour(h: number): string {
    return `${String(h).padStart(2, "0")}:00`;
  }

  const nowRef = useRef(new Date());
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      nowRef.current = new Date();
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const sessionsByDay = useMemo(() => buildSessionsByDay(sessions), [sessions]);
  const eventsByDay = useMemo(() => buildEventsByDay(events), [events]);

  const todayIdx = weekDays.findIndex(isToday);

  const allDayLayouts = useMemo(
    () =>
      weekDays.map((day) =>
        computeDayLayout(
          sessionsByDay.get(toDateString(day)) ?? [],
          startHour,
          endHour,
          hourHeight,
          eventsByDay.get(toDateString(day)) ?? [],
        ),
      ),
    [eventsByDay, sessionsByDay, weekDays, startHour, endHour, hourHeight],
  );

  function getCurrentTimePosition(): number | null {
    const currentMinutes = getMinutesSinceMidnight(nowRef.current);
    const startMinutes = startHour * 60;
    if (currentMinutes < startMinutes || currentMinutes > (endHour + 1) * 60)
      return null;

    const offsetMin = currentMinutes - startMinutes;
    return (offsetMin / 60) * hourHeight;
  }

  const currentTimePos = getCurrentTimePosition();
  const weekScrollKey = toDateString(weekDays[0] ?? new Date());

  const desktopGridTotalHeight = Math.max(
    ...allDayLayouts.map((l) => l.totalHeight),
  );

  return (
    <div className="border border-sahara-border bg-sahara-surface">
      <CalendarMobileView
        scrollMemoryKey={`calendar:${weekScrollKey}:mobile`}
        weekDays={weekDays}
        allDayLayouts={allDayLayouts}
        hours={hours}
        formatHour={formatHour}
        currentTimePos={currentTimePos}
        sessions={sessions}
        events={events}
        onEditPomo={onEditPomo}
        onEditEvent={onEditEvent}
      />
      <CalendarDesktopView
        scrollMemoryKey={`calendar:${weekScrollKey}:desktop`}
        weekDays={weekDays}
        allDayLayouts={allDayLayouts}
        hours={hours}
        formatHour={formatHour}
        currentTimePos={currentTimePos}
        todayIdx={todayIdx}
        desktopGridTotalHeight={desktopGridTotalHeight}
        sessions={sessions}
        events={events}
        onEditPomo={onEditPomo}
        onCreateEvent={onCreateEvent}
        onEditEvent={onEditEvent}
        startHour={startHour}
        hourHeight={hourHeight}
      />
    </div>
  );
}
