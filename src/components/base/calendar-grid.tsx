import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { WeekSession } from "@/lib/db";
import { formatTimeAmPm, parseLocalDateTime } from "@/lib/time";
import { CalendarSessionBlock } from "./calendar-session-block";
import { CalendarDayPill } from "./calendar-day-pill";

interface CalendarGridProps {
  sessions: WeekSession[];
  weekDays: Date[];
  startHour: number;
  endHour: number;
  hourHeight: number;
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

interface PositionedSession {
  session: WeekSession;
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
): DayLayout {
  const hourCount = endHour - startHour + 1;
  const totalVisibleMinutes = hourCount * 60;
  const totalHeight = hourCount * hourHeight;
  const sorted = daySessions.toSorted(
    (a, b) =>
      parseLocalDateTime(a.started_at).getTime() -
      parseLocalDateTime(b.started_at).getTime(),
  );

  const positioned: PositionedSession[] = [];
  const idleGaps: IdleGap[] = [];
  let previousEndMin: number | null = null;
  let previousEndTime: Date | null = null;

  for (const session of sorted) {
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

    if (previousEndMin !== null && previousEndTime !== null) {
      const gapMin = visibleStartMin - previousEndMin;
      if (gapMin >= MIN_LABELED_IDLE_GAP_MINUTES) {
        idleGaps.push({
          id: `${previousEndTime.toISOString()}-${startTime.toISOString()}`,
          start: previousEndTime,
          end: startTime,
          topPx: (previousEndMin / 60) * hourHeight,
          heightPx: (gapMin / 60) * hourHeight,
          durationMin: gapMin,
        });
      }
    }

    const topPx = (visibleStartMin / 60) * hourHeight;
    const heightPx = ((visibleEndMin - visibleStartMin) / 60) * hourHeight;

    positioned.push({
      session,
      topPx,
      heightPx,
      compact: heightPx < 48,
    });

    if (previousEndMin === null || visibleEndMin > previousEndMin) {
      previousEndMin = visibleEndMin;
      previousEndTime = endTime;
    }
  }

  const hourTopPx = Array.from(
    { length: hourCount + 1 },
    (_, idx) => idx * hourHeight,
  );

  return {
    positioned,
    idleGaps,
    hourTopPx,
    totalHeight,
  };
}

interface CalendarMobileViewProps {
  weekDays: Date[];
  allDayLayouts: DayLayout[];
  selectedMobileDay: number;
  onSelectMobileDay: (idx: number) => void;
  hours: number[];
  formatHour: (h: number) => string;
  currentTimePos: number | null;
  sessions: WeekSession[];
}

function CalendarMobileView({
  weekDays, allDayLayouts, selectedMobileDay, onSelectMobileDay,
  hours, formatHour, currentTimePos, sessions,
}: CalendarMobileViewProps) {
  const layout = allDayLayouts[selectedMobileDay];
  const dayDate = weekDays[selectedMobileDay];
  const today = isToday(dayDate);

  return (
    <div className="md:hidden flex flex-col">
      <div className="grid grid-cols-7 border-b border-sahara-border/30 px-1">
        {weekDays.map((day, idx) => (
          <CalendarDayPill
            key={day.toDateString()}
            date={day}
            isSelected={idx === selectedMobileDay}
            isToday={isToday(day)}
            onClick={() => onSelectMobileDay(idx)}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative pt-8">
        <div className="flex" style={{ minHeight: layout.totalHeight }}>
          <div className="w-12 shrink-0 border-r border-sahara-border/15 bg-sahara-bg/20 relative">
            {hours.map((hour, hIdx) => {
              const maxH = Math.max(
                layout.hourTopPx[hIdx + 1] - layout.hourTopPx[hIdx],
              );
              return (
                <div
                  key={hour}
                  className="pr-2 text-right border-b border-sahara-border/10"
                  style={{ height: maxH }}
                >
                  <span className="text-[10px] font-medium text-sahara-text-muted tabular-nums leading-none inline-block mt-2">
                    {formatHour(hour)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={cn("flex-1 relative", today && "bg-sahara-primary-light/10")} style={{ minHeight: layout.totalHeight }}>
            {hours.map((_, hIdx) => (
              <div
                key={hIdx}
                className="border-b border-sahara-border/8"
                style={{ height: layout.hourTopPx[hIdx + 1] - layout.hourTopPx[hIdx] }}
              />
            ))}

            {layout.idleGaps.map((gap) => (
              <CalendarIdleGap key={gap.id} gap={gap} />
            ))}

            {layout.positioned.map(({ session, topPx, heightPx, compact }) => (
              <CalendarSessionBlock key={session.id} session={session} topPx={topPx} heightPx={heightPx} compact={compact} />
            ))}

            {currentTimePos !== null && today && (
              <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: currentTimePos }}>
                <div className="size-1.5 rounded-full bg-sahara-primary -ml-1 shadow-sm" />
                <div className="flex-1 border-t border-sahara-primary/50" />
              </div>
            )}
          </div>
        </div>

        {sessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center opacity-30">
              <p className="text-xs font-semibold text-sahara-text-muted uppercase tracking-wider">这天还没有记录</p>
              <p className="text-[11px] text-sahara-text-muted mt-1">完成后的记录会显示在这里</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CalendarDesktopViewProps {
  weekDays: Date[];
  allDayLayouts: DayLayout[];
  hours: number[];
  formatHour: (h: number) => string;
  currentTimePos: number | null;
  todayIdx: number;
  desktopGridTotalHeight: number;
  sessions: WeekSession[];
}

function CalendarDesktopView({
  weekDays, allDayLayouts, hours, formatHour,
  currentTimePos, todayIdx, desktopGridTotalHeight, sessions,
}: CalendarDesktopViewProps) {
  return (
    <div className="hidden md:flex flex-col flex-1 min-h-0">
      <div className="grid border-b border-sahara-border/30" style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}>
        <div className="p-4 border-r border-sahara-border/20" />
        {weekDays.map((day) => {
          const dayIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
          const today = isToday(day);
          return (
            <div key={day.toDateString()} className={cn("px-2 pt-3 pb-2 text-center border-r last:border-r-0 border-sahara-border/20 relative", today && "bg-sahara-primary-light/20")}>
              <span className={cn("text-[10px] font-medium tracking-[0.15em] block mb-0.5", today ? "text-sahara-primary" : "text-sahara-text-muted")}>{DAY_LABELS_FULL[dayIdx]}</span>
              <p className={cn("font-serif text-2xl leading-none", today ? "text-sahara-primary font-bold" : "text-sahara-text")}>{day.getDate()}</p>
              {today && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-sahara-primary rounded-full" />}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)`, minHeight: desktopGridTotalHeight }}>
          <div className="border-r border-sahara-border/20 bg-sahara-bg/30 relative shrink-0 w-16">
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
              <div key={day.toDateString()} className={cn("relative border-r last:border-r-0 border-sahara-border/15", today && "bg-sahara-primary-light/30")} style={{ minHeight: desktopGridTotalHeight }}>
                {hours.map((_, hIdx) => (
                  <div key={hIdx} className="border-b border-sahara-border/10" style={{ height: layout.hourTopPx[hIdx + 1] - layout.hourTopPx[hIdx] }} />
                ))}
                {layout.idleGaps.map((gap) => (
                  <CalendarIdleGap key={gap.id} gap={gap} />
                ))}
                {layout.positioned.map(({ session, topPx, heightPx, compact }) => (
                  <CalendarSessionBlock key={session.id} session={session} topPx={topPx} heightPx={heightPx} compact={compact} />
                ))}
                {currentTimePos !== null && idx === todayIdx && (
                  <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: currentTimePos }}>
                    <div className="size-1.5 rounded-full bg-sahara-primary -ml-1 shadow-sm" />
                    <div className="flex-1 border-t border-sahara-primary/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center opacity-30">
              <p className="text-xs font-semibold text-sahara-text-muted uppercase tracking-wider">本周还没有记录</p>
              <p className="text-[11px] text-sahara-text-muted mt-1">完成后的记录会显示在这里</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  sessions,
  weekDays,
  startHour,
  endHour,
  hourHeight,
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

  const todayIdx = weekDays.findIndex(isToday);

  const [selectedMobileDay, setSelectedMobileDay] = useState(
    todayIdx >= 0 ? todayIdx : 0,
  );

  useEffect(() => {
    if (todayIdx >= 0) setSelectedMobileDay(todayIdx);
  }, [todayIdx]);

  const allDayLayouts = useMemo(
    () =>
      weekDays.map((day) =>
        computeDayLayout(
          sessionsByDay.get(toDateString(day)) ?? [],
          startHour,
          endHour,
          hourHeight,
        ),
      ),
    [sessionsByDay, weekDays, startHour, endHour, hourHeight],
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

  const desktopGridTotalHeight = Math.max(
    ...allDayLayouts.map((l) => l.totalHeight),
  );

  return (
    <div className="bg-sahara-surface rounded-2xl overflow-hidden shadow-sm border border-sahara-border/40 flex flex-col">
      <CalendarMobileView
        weekDays={weekDays}
        allDayLayouts={allDayLayouts}
        selectedMobileDay={selectedMobileDay}
        onSelectMobileDay={setSelectedMobileDay}
        hours={hours}
        formatHour={formatHour}
        currentTimePos={currentTimePos}
        sessions={sessions}
      />
      <CalendarDesktopView
        weekDays={weekDays}
        allDayLayouts={allDayLayouts}
        hours={hours}
        formatHour={formatHour}
        currentTimePos={currentTimePos}
        todayIdx={todayIdx}
        desktopGridTotalHeight={desktopGridTotalHeight}
        sessions={sessions}
      />
    </div>
  );
}
