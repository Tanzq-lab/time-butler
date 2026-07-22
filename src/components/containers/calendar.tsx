import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  getWeekSessions,
  getWeekSummary,
  reassignCompletedPomo,
  recordAppEvent,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventInput,
  type WeekSession,
  type WeekSummary,
} from "@/lib/db";
import { CalendarEventEditor, type CalendarEventRange } from "@/components/base/calendar-event-editor";
import { CalendarSessionEditor } from "@/components/base/calendar-session-editor";
import { CalendarWeekNav } from "@/components/base/calendar-week-nav";
import { CalendarGrid } from "@/components/base/calendar-grid";
import { CalendarWeekStats } from "@/components/base/calendar-week-stats";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskStore } from "@/features/tasks/use-task-store";

const START_HOUR = 6;
const END_HOUR = 22;
// A 25-minute focus block should have enough vertical room to scan at a glance
// without pretending that it lasts longer than the real time it occupies.
const HOUR_HEIGHT = 96;

const EMPTY_SUMMARY: WeekSummary = {
  total_seconds: 0,
  total_sessions: 0,
  work_sessions: 0,
  break_sessions: 0,
  avg_daily_seconds: 0,
  completed_pomos: 0,
  avg_daily_pomos: 0,
  peak_day: null,
  peak_day_seconds: 0,
  peak_day_pomos: 0,
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
  events: CalendarEvent[];
  summary: WeekSummary;
}

const CALENDAR_INIT: CalendarData = {
  sessions: [],
  events: [],
  summary: EMPTY_SUMMARY,
};

function normalizeWeekSummary(summary: WeekSummary | null | undefined): WeekSummary {
  return {
    total_seconds: Number.isFinite(summary?.total_seconds) ? summary!.total_seconds : 0,
    total_sessions: Number.isFinite(summary?.total_sessions) ? summary!.total_sessions : 0,
    work_sessions: Number.isFinite(summary?.work_sessions) ? summary!.work_sessions : 0,
    break_sessions: Number.isFinite(summary?.break_sessions) ? summary!.break_sessions : 0,
    avg_daily_seconds: Number.isFinite(summary?.avg_daily_seconds) ? summary!.avg_daily_seconds : 0,
    completed_pomos: Number.isFinite(summary?.completed_pomos) ? summary!.completed_pomos : 0,
    avg_daily_pomos: Number.isFinite(summary?.avg_daily_pomos) ? summary!.avg_daily_pomos : 0,
    peak_day: summary?.peak_day ?? null,
    peak_day_seconds: Number.isFinite(summary?.peak_day_seconds) ? summary!.peak_day_seconds : 0,
    peak_day_pomos: Number.isFinite(summary?.peak_day_pomos) ? summary!.peak_day_pomos : 0,
  };
}

type CalendarAction =
  | { type: "LOADED"; sessions: WeekSession[]; events: CalendarEvent[]; summary: WeekSummary }
  | { type: "ERROR" };

function calendarReducer(_state: CalendarData, action: CalendarAction): CalendarData {
  switch (action.type) {
    case "LOADED":
      return {
        sessions: Array.isArray(action.sessions) ? action.sessions : [],
        events: Array.isArray(action.events) ? action.events : [],
        summary: normalizeWeekSummary(action.summary),
      };
    case "ERROR":
      return { sessions: [], events: [], summary: EMPTY_SUMMARY };
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateTime(date: Date): string {
  return `${toISODate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getDefaultEventRange(weekDays: Date[]): CalendarEventRange {
  const now = new Date();
  const todayKey = toISODate(now);
  const matchingDay = weekDays.find((day) => toISODate(day) === todayKey);
  const start = new Date(matchingDay ?? weekDays[0]);

  if (matchingDay) {
    start.setHours(now.getHours(), Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    if (
      start.getHours() < START_HOUR ||
      start.getHours() > END_HOUR ||
      (start.getHours() === END_HOUR && start.getMinutes() > 30)
    ) {
      start.setHours(9, 0, 0, 0);
    }
  } else {
    start.setHours(9, 0, 0, 0);
  }

  const end = new Date(start.getTime() + 30 * 60_000);
  return { startsAt: toLocalDateTime(start), endsAt: toLocalDateTime(end) };
}

interface EventEditorState {
  event: CalendarEvent | null;
  initialRange: CalendarEventRange | null;
  source: "button" | "drag" | "event";
}

export function CalendarDashboard() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, dispatch] = useReducer(calendarReducer, CALENDAR_INIT);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [sessionToEdit, setSessionToEdit] = useState<WeekSession | null>(null);
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteEventError, setDeleteEventError] = useState("");
  const loadedRef = useRef<string | null>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const loadTasks = useTaskStore((state) => state.loadTasks);

  const monday = getMonday(new Date(Date.now() + weekOffset * 7 * 86400000));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekDays = getWeekDates(monday);
  const weekKey = `${toISODate(monday)}_${toISODate(sunday)}`;
  const loadKey = `${weekKey}_${refreshVersion}`;

  useEffect(() => {
    if (loadedRef.current === loadKey) return;
    loadedRef.current = loadKey;

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
        getCalendarEvents(startStr, endStr).catch(() => [] as CalendarEvent[]),
      ]),
      timeout,
    ])
      .then(([sessData, summaryData, eventData]) => {
        if (!cancelled) dispatch({ type: "LOADED", sessions: sessData, events: eventData, summary: summaryData });
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
  }, [loadKey]);

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

  const handleOpenPomoEditor = useCallback((session: WeekSession) => {
    setSessionToEdit(session);
    void recordAppEvent({
      eventName: "calendar_completed_pomo_editor_opened",
      route: "/calendar",
      entityType: "session",
      entityId: session.id,
      metadata: { hasTask: session.task_id !== null },
    });
  }, []);

  const handleReassignCompletedPomo = useCallback(
    async (targetTaskId: number) => {
      if (!sessionToEdit) return;

      const result = await reassignCompletedPomo(sessionToEdit.id, targetTaskId);
      void recordAppEvent({
        eventName: "calendar_completed_pomo_reassigned",
        route: "/calendar",
        entityType: "session",
        entityId: sessionToEdit.id,
        metadata: {
          sourceTaskId: result.sourceTaskId,
          targetTaskId: result.targetTaskId,
          categoryChanged: result.sourceCategoryId !== result.targetCategoryId,
        },
      });
      await loadTasks();
      setRefreshVersion((version) => version + 1);
    },
    [loadTasks, sessionToEdit],
  );

  const openEventEditor = useCallback((state: EventEditorState) => {
    setEventEditor(state);
    const range = state.event
      ? { startsAt: state.event.starts_at, endsAt: state.event.ends_at }
      : state.initialRange;
    const durationMinutes = range
      ? Math.round((new Date(range.endsAt.replace(" ", "T")).getTime() - new Date(range.startsAt.replace(" ", "T")).getTime()) / 60_000)
      : null;
    void recordAppEvent({
      eventName: "calendar_event_editor_opened",
      route: "/calendar",
      entityType: state.event ? "calendar_event" : null,
      entityId: state.event?.id ?? null,
      metadata: { source: state.source, durationMinutes },
    });
  }, []);

  const handleCreateRange = useCallback((range: CalendarEventRange) => {
    openEventEditor({ event: null, initialRange: range, source: "drag" });
  }, [openEventEditor]);

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    openEventEditor({ event, initialRange: null, source: "event" });
  }, [openEventEditor]);

  const handleSaveEvent = useCallback(async (input: CalendarEventInput) => {
    const durationMinutes = Math.round(
      (new Date(input.endsAt.replace(" ", "T")).getTime() - new Date(input.startsAt.replace(" ", "T")).getTime()) / 60_000,
    );
    if (eventEditor?.event) {
      await updateCalendarEvent(eventEditor.event.id, input);
      void recordAppEvent({
        eventName: "calendar_event_updated",
        route: "/calendar",
        entityType: "calendar_event",
        entityId: eventEditor.event.id,
        metadata: { durationMinutes, hasNotes: Boolean(input.notes?.trim()) },
      });
    } else {
      const eventId = await addCalendarEvent(input);
      void recordAppEvent({
        eventName: "calendar_event_created",
        route: "/calendar",
        entityType: "calendar_event",
        entityId: eventId,
        metadata: { source: eventEditor?.source ?? "unknown", durationMinutes, hasNotes: Boolean(input.notes?.trim()) },
      });
    }
    setRefreshVersion((version) => version + 1);
  }, [eventEditor]);

  const handleDeleteEvent = useCallback(async () => {
    if (!eventToDelete) return;
    setDeletingEvent(true);
    setDeleteEventError("");
    try {
      await deleteCalendarEvent(eventToDelete.id);
      void recordAppEvent({
        eventName: "calendar_event_deleted",
        route: "/calendar",
        entityType: "calendar_event",
        entityId: eventToDelete.id,
      });
      setEventToDelete(null);
      setEventEditor(null);
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      setDeleteEventError(
        error instanceof Error ? error.message : "无法删除这段时间，请稍后重试。",
      );
    } finally {
      setDeletingEvent(false);
    }
  }, [eventToDelete]);

  if (loading && data.sessions.length === 0 && data.events.length === 0) {
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
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 px-3 py-6 sm:px-6 md:gap-6 md:px-10 md:py-8">
      {/* Header */}
      <PageHeader
        eyebrow="时间分布"
        title="每周时间线"
        description="拖动空白时段记录会议等其他时间；专注仍按完成番茄单独统计。"
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              variant="solid"
              intent="sahara"
              size="sm"
              onClick={() => openEventEditor({ event: null, initialRange: getDefaultEventRange(weekDays), source: "button" })}
            >
              <CalendarPlus className="mr-1.5 size-4" aria-hidden="true" />
              添加时间
            </Button>
            <CalendarWeekNav
              weekStart={monday}
              weekEnd={sunday}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
            />
          </div>
        }
      />

      {/* Week Stats */}
      <CalendarWeekStats summary={data.summary} calendarEvents={data.events} />

      {/* Calendar Grid */}
      <div>
        <CalendarGrid
          sessions={data.sessions}
          events={data.events}
          weekDays={weekDays}
          startHour={START_HOUR}
          endHour={END_HOUR}
          hourHeight={HOUR_HEIGHT}
          onEditPomo={handleOpenPomoEditor}
          onCreateEvent={handleCreateRange}
          onEditEvent={handleEditEvent}
        />
      </div>

      <CalendarSessionEditor
        open={sessionToEdit !== null}
        session={sessionToEdit}
        tasks={tasks}
        onClose={() => setSessionToEdit(null)}
        onSubmit={handleReassignCompletedPomo}
      />

      <CalendarEventEditor
        open={eventEditor !== null}
        event={eventEditor?.event ?? null}
        initialRange={eventEditor?.initialRange ?? null}
        onClose={() => setEventEditor(null)}
        onSubmit={handleSaveEvent}
        onRequestDelete={eventEditor?.event ? () => {
          setDeleteEventError("");
          setEventToDelete(eventEditor.event);
        } : undefined}
      />

      <ConfirmDialog
        open={eventToDelete !== null}
        title="删除这段时间？"
        description={deleteEventError || (eventToDelete ? `“${eventToDelete.title}”会从日历中移除，此操作无法撤销。` : "这条时间记录会从日历中移除。")}
        confirmLabel="删除时间"
        destructive
        busy={deletingEvent}
        onClose={() => {
          if (!deletingEvent) {
            setDeleteEventError("");
            setEventToDelete(null);
          }
        }}
        onConfirm={handleDeleteEvent}
      />
    </div>
  );
}
