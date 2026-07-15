import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { Loader2 } from "lucide-react";
import {
  getWeekSessions,
  getWeekSummary,
  type WeekSession,
  type WeekSummary,
} from "@/lib/db";
import { CalendarWeekNav } from "@/components/base/calendar-week-nav";
import { CalendarGrid } from "@/components/base/calendar-grid";
import { CalendarWeekStats } from "@/components/base/calendar-week-stats";
import { PageHeader } from "@/components/ui/page-header";

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 72;

const EMPTY_SUMMARY: WeekSummary = {
  total_seconds: 0,
  total_sessions: 0,
  work_sessions: 0,
  break_sessions: 0,
  avg_daily_seconds: 0,
  peak_day: null,
  peak_day_seconds: 0,
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CalendarData {
  sessions: WeekSession[];
  summary: WeekSummary;
}

const CALENDAR_INIT: CalendarData = {
  sessions: [],
  summary: EMPTY_SUMMARY,
};

function normalizeWeekSummary(summary: WeekSummary | null | undefined): WeekSummary {
  return {
    total_seconds: Number.isFinite(summary?.total_seconds) ? summary!.total_seconds : 0,
    total_sessions: Number.isFinite(summary?.total_sessions) ? summary!.total_sessions : 0,
    work_sessions: Number.isFinite(summary?.work_sessions) ? summary!.work_sessions : 0,
    break_sessions: Number.isFinite(summary?.break_sessions) ? summary!.break_sessions : 0,
    avg_daily_seconds: Number.isFinite(summary?.avg_daily_seconds) ? summary!.avg_daily_seconds : 0,
    peak_day: summary?.peak_day ?? null,
    peak_day_seconds: Number.isFinite(summary?.peak_day_seconds) ? summary!.peak_day_seconds : 0,
  };
}

type CalendarAction =
  | { type: "LOADED"; sessions: WeekSession[]; summary: WeekSummary }
  | { type: "ERROR" };

function calendarReducer(_state: CalendarData, action: CalendarAction): CalendarData {
  switch (action.type) {
    case "LOADED":
      return {
        sessions: Array.isArray(action.sessions) ? action.sessions : [],
        summary: normalizeWeekSummary(action.summary),
      };
    case "ERROR":
      return { sessions: [], summary: EMPTY_SUMMARY };
  }
}

export function CalendarDashboard() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, dispatch] = useReducer(calendarReducer, CALENDAR_INIT);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef<string | null>(null);

  const monday = getMonday(new Date(Date.now() + weekOffset * 7 * 86400000));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekDays = getWeekDates(monday);
  const weekKey = `${toISODate(monday)}_${toISODate(sunday)}`;

  useEffect(() => {
    if (loadedRef.current === weekKey) return;
    loadedRef.current = weekKey;

    let cancelled = false;
    setLoading(true);

    const startStr = toISODate(monday);
    const endStr = toISODate(sunday);

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("timeout")), 5000);
    });

    Promise.race([
      Promise.all([
        getWeekSessions(startStr, endStr).catch(() => [] as WeekSession[]),
        getWeekSummary(startStr, endStr).catch(() => EMPTY_SUMMARY),
      ]),
      timeout,
    ])
      .then(([sessData, summaryData]) => {
        if (!cancelled) dispatch({ type: "LOADED", sessions: sessData, summary: summaryData });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "ERROR" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [weekKey]);

  const handlePrev = useCallback(() => {
    loadedRef.current = null;
    setWeekOffset((o) => o - 1);
  }, []);
  const handleNext = useCallback(() => {
    loadedRef.current = null;
    setWeekOffset((o) => o + 1);
  }, []);
  const handleToday = useCallback(() => {
    loadedRef.current = null;
    setWeekOffset(0);
  }, []);

  if (loading && data.sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="size-8 text-sahara-primary animate-spin" />
        <p className="text-xs font-medium text-sahara-text-secondary">
          正在加载日历…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-5 px-3 py-6 sm:px-6 md:gap-6 md:px-10 md:py-8">
      {/* Header */}
      <PageHeader
        eyebrow="时间分布"
        title="每周时间线"
        description="按时间轴查看专注与休息，分类色仅用于区分会话。"
        actions={<CalendarWeekNav
          weekStart={monday}
          weekEnd={sunday}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />}
      />

      {/* Week Stats */}
      <CalendarWeekStats summary={data.summary} />

      {/* Calendar Grid */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CalendarGrid
          sessions={data.sessions}
          weekDays={weekDays}
          startHour={START_HOUR}
          endHour={END_HOUR}
          hourHeight={HOUR_HEIGHT}
        />
      </div>
    </div>
  );
}
