import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarRange, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { CalendarEvent, CalendarEventInput } from "@/lib/db";
import { parseLocalDateTime } from "@/lib/time";

export interface CalendarEventRange {
  startsAt: string;
  endsAt: string;
}

interface CalendarEventEditorProps {
  open: boolean;
  event: CalendarEvent | null;
  initialRange: CalendarEventRange | null;
  onClose: () => void;
  onSubmit: (input: CalendarEventInput) => Promise<void>;
  onRequestDelete?: () => void;
}

const FIELD_CLASS =
  "min-h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 py-2 text-sm text-sahara-text outline-none transition-colors placeholder:text-sahara-text-muted focus:border-sahara-text-muted focus:ring-2 focus:ring-sahara-focus disabled:cursor-not-allowed disabled:opacity-55";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getFallbackRange(): CalendarEventRange {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  if (start.getHours() < 6 || start.getHours() >= 23) {
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 30 * 60_000);
  return { startsAt: toLocalDateTime(start), endsAt: toLocalDateTime(end) };
}

function splitLocalDateTime(value: string): { date: string; time: string } {
  const parsed = parseLocalDateTime(value);
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

export function CalendarEventEditor({
  open,
  event,
  initialRange,
  onClose,
  onSubmit,
  onRequestDelete,
}: CalendarEventEditorProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const range = event
      ? { startsAt: event.starts_at, endsAt: event.ends_at }
      : initialRange ?? getFallbackRange();
    const start = splitLocalDateTime(range.startsAt);
    const end = splitLocalDateTime(range.endsAt);
    setTitle(event?.title ?? "");
    setDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
    setNotes(event?.notes ?? "");
    setSaving(false);
    setError("");
    const focusFrame = window.requestAnimationFrame(() => {
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(min-width: 768px)").matches
      ) {
        titleInputRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [event, initialRange, open]);

  const durationMinutes = useMemo(() => {
    if (!date || !startTime || !endTime) return 0;
    const start = parseLocalDateTime(`${date} ${startTime}:00`).getTime();
    const end = parseLocalDateTime(`${date} ${endTime}:00`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.round((end - start) / 60_000);
  }, [date, endTime, startTime]);

  if (!open) return null;

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!title.trim()) {
      setError("请填写这段时间的内容。");
      titleInputRef.current?.focus();
      return;
    }
    if (durationMinutes <= 0) {
      setError("结束时间必须晚于开始时间。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        title,
        startsAt: `${date} ${startTime}:00`,
        endsAt: `${date} ${endTime}:00`,
        notes,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "无法保存这段时间，请稍后重试。");
      setSaving(false);
    }
  };

  return (
    <ModalOverlay
      open
      onClose={saving ? () => undefined : onClose}
      maxWidth="max-w-lg"
      showCloseButton
      ariaLabel={event ? "编辑时间记录" : "添加时间记录"}
    >
      <form onSubmit={(submitEvent) => void handleSubmit(submitEvent)} className="p-5 md:p-6">
        <div className="flex items-start gap-3 pr-8">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-sahara-card text-sahara-text-secondary">
            <CalendarRange className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[0.08em] text-sahara-text-muted">
              不计入专注 · 只说明时间去向
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-sahara-text">
              {event ? "编辑这段时间" : "这段时间做了什么？"}
            </h2>
          </div>
        </div>

        <label className="mt-5 block text-xs font-medium text-sahara-text" htmlFor="calendar-event-title">
          内容
        </label>
        <input
          ref={titleInputRef}
          id="calendar-event-title"
          name="calendar-event-title"
          value={title}
          onChange={(inputEvent) => {
            setTitle(inputEvent.target.value);
            setError("");
          }}
          maxLength={120}
          autoComplete="off"
          disabled={saving}
          placeholder="例如：产品周会…"
          className={`${FIELD_CLASS} mt-2`}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <label className="block text-xs font-medium text-sahara-text" htmlFor="calendar-event-date">
              日期
            </label>
            <input
              id="calendar-event-date"
              name="calendar-event-date"
              type="date"
              autoComplete="off"
              value={date}
              onChange={(inputEvent) => setDate(inputEvent.target.value)}
              disabled={saving}
              required
              className={`${FIELD_CLASS} mt-2 font-mono tabular-nums`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sahara-text" htmlFor="calendar-event-start">
              开始
            </label>
            <input
              id="calendar-event-start"
              name="calendar-event-start"
              type="time"
              autoComplete="off"
              min="06:00"
              max="22:45"
              step={900}
              value={startTime}
              onChange={(inputEvent) => setStartTime(inputEvent.target.value)}
              disabled={saving}
              required
              className={`${FIELD_CLASS} mt-2 font-mono tabular-nums`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sahara-text" htmlFor="calendar-event-end">
              结束
            </label>
            <input
              id="calendar-event-end"
              name="calendar-event-end"
              type="time"
              autoComplete="off"
              min="06:15"
              max="23:00"
              step={900}
              value={endTime}
              onChange={(inputEvent) => setEndTime(inputEvent.target.value)}
              disabled={saving}
              required
              className={`${FIELD_CLASS} mt-2 font-mono tabular-nums`}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-sahara-text-secondary">
          <Clock3 className="size-3.5" aria-hidden="true" />
          <span className="font-mono tabular-nums">
            {durationMinutes > 0 ? formatDuration(durationMinutes) : "请选择有效时段"}
          </span>
        </div>

        <label className="mt-4 block text-xs font-medium text-sahara-text" htmlFor="calendar-event-notes">
          备注 <span className="font-normal text-sahara-text-muted">（可选）</span>
        </label>
        <textarea
          id="calendar-event-notes"
          name="calendar-event-notes"
          value={notes}
          onChange={(inputEvent) => setNotes(inputEvent.target.value)}
          maxLength={2000}
          rows={3}
          autoComplete="off"
          disabled={saving}
          placeholder="补充会议结论、地点或上下文…"
          className={`${FIELD_CLASS} mt-2 resize-y leading-5`}
        />

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-[#b42318]/8 px-3 py-2 text-xs leading-5 text-[#982018] dark:text-[#ffb4aa]">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {event && onRequestDelete ? (
            <Button
              variant="ghost"
              intent="red"
              size="sm"
              disabled={saving}
              onClick={onRequestDelete}
            >
              删除记录
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="outline" intent="default" size="sm" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="solid" intent="sahara" size="sm" disabled={saving}>
              {saving ? "正在保存…" : "保存时间"}
            </Button>
          </div>
        </div>
      </form>
    </ModalOverlay>
  );
}
