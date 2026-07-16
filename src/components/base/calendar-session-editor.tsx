import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { isTaskDone } from "@/features/tasks/task-completion";
import type { Task } from "@/features/tasks/task-types";
import type { WeekSession } from "@/lib/db";
import { formatTimeAmPm, parseLocalDateTime } from "@/lib/time";

interface CalendarSessionEditorProps {
  open: boolean;
  session: WeekSession | null;
  tasks: Task[];
  onClose: () => void;
  onSubmit: (targetTaskId: number) => Promise<void>;
}

const MAX_VISIBLE_TASKS = 8;

function formatDuration(durationSec: number): string {
  const minutes = Math.max(1, Math.round(durationSec / 60));
  return `${minutes} 分钟`;
}

function formatTimeRange(session: WeekSession): string {
  const start = parseLocalDateTime(session.started_at);
  const end = new Date(start.getTime() + session.duration_sec * 1000);
  return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
}

function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function getTaskDateKey(task: Task): string | null {
  return task.scheduled_for?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function formatDateLabel(dateKey: string): string {
  const [, month = "", day = ""] = dateKey.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

/** Edits only the task attribution of one completed, counted focus pomodoro. */
export function CalendarSessionEditor({
  open,
  session,
  tasks,
  onClose,
  onSubmit,
}: CalendarSessionEditorProps) {
  const [targetTaskId, setTargetTaskId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sessionDateKey = session ? toDateKey(parseLocalDateTime(session.started_at)) : "";

  const targetTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.archived === 0 &&
            task.id !== session?.task_id,
        )
        .toSorted((left, right) => {
          const leftSameDay = getTaskDateKey(left) === sessionDateKey;
          const rightSameDay = getTaskDateKey(right) === sessionDateKey;
          if (leftSameDay !== rightSameDay) return leftSameDay ? -1 : 1;
          return (right.scheduled_for ?? "").localeCompare(left.scheduled_for ?? "");
        }),
    [session?.task_id, sessionDateKey, tasks],
  );

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const matchingTasks = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    return targetTasks
      .filter((task) => {
        const searchableText = `${task.name} ${task.project ?? ""}`.toLocaleLowerCase();
        return searchableText.includes(normalizedSearchQuery);
      })
      .slice(0, MAX_VISIBLE_TASKS);
  }, [normalizedSearchQuery, targetTasks]);

  const selectedTask = useMemo(
    () => targetTasks.find((task) => task.id === Number(targetTaskId)) ?? null,
    [targetTaskId, targetTasks],
  );
  const sameDayMatchingTasks = matchingTasks.filter(
    (task) => getTaskDateKey(task) === sessionDateKey,
  );
  const otherMatchingTasks = matchingTasks.filter(
    (task) => getTaskDateKey(task) !== sessionDateKey,
  );

  useEffect(() => {
    if (!open) return;
    setTargetTaskId("");
    setSearchQuery("");
    setSaving(false);
    setError("");
    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open, session?.id]);

  if (!session) return null;

  const canSubmit = Boolean(targetTaskId) && !saving;

  const selectTask = (task: Task) => {
    setTargetTaskId(String(task.id));
    setSearchQuery("");
    setError("");
  };

  const renderTaskOption = (task: Task) => {
    const selected = task.id === Number(targetTaskId);
    const taskDateKey = getTaskDateKey(task);
    const dateLabel = taskDateKey
      ? `${taskDateKey === sessionDateKey ? "同一天" : "计划于"} ${formatDateLabel(taskDateKey)}`
      : "未排期";

    return (
      <button
        key={task.id}
        type="button"
        role="option"
        aria-selected={selected}
        aria-label={`选择任务 ${task.name}，${dateLabel}，${task.completed_pomos}/${task.estimated_pomos} 番茄${isTaskDone(task) ? "，已完成" : ""}`}
        disabled={saving}
        onClick={() => selectTask(task)}
        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="min-w-0 truncate text-sm font-medium text-sahara-text">
          {task.name}
        </span>
        <span className="text-[11px] text-sahara-text-muted">
          {dateLabel}{task.project ? ` · ${task.project}` : ""} · {task.completed_pomos}/{task.estimated_pomos} 番茄{isTaskDone(task) ? " · 已完成" : ""}
        </span>
      </button>
    );
  };

  const handleSubmit = async () => {
    const parsedTargetTaskId = Number(targetTaskId);
    if (!Number.isInteger(parsedTargetTaskId) || parsedTargetTaskId <= 0) {
      setError("请选择要归属的任务。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit(parsedTargetTaskId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法更正这个番茄，请稍后重试。");
      setSaving(false);
    }
  };

  return (
    <ModalOverlay
      open={open}
      onClose={saving ? () => undefined : onClose}
      maxWidth="max-w-md"
      showCloseButton
      ariaLabel="更正番茄归属"
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-3 pr-8">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-sahara-card text-sahara-text-secondary">
            <Clock3 className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[0.08em] text-sahara-text-muted">
              已完成专注 · 1 个番茄
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-sahara-text">
              更正番茄归属
            </h2>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-sahara-border bg-sahara-card/60 px-3.5 py-3">
          <p className="font-mono text-xs font-medium tabular-nums text-sahara-text">
            {formatDateLabel(sessionDateKey)} · {formatTimeRange(session)} · {formatDuration(session.duration_sec)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-sahara-text">
              {session.task_name || "未归属任务"}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-sahara-text-muted" aria-hidden="true" />
            <span className="text-sahara-text-secondary">选择新任务</span>
          </div>
        </div>

        <label className="mt-5 block text-xs font-medium text-sahara-text" htmlFor="calendar-session-task-search">
          所属任务
        </label>
        <div className="mt-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sahara-text-muted"
            />
            <input
              ref={searchInputRef}
              id="calendar-session-task-search"
              aria-label="搜索所属任务"
              type="search"
              value={searchQuery}
              disabled={saving || targetTasks.length === 0}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={targetTasks.length === 0 ? "没有可归属的未归档任务" : "搜索任务或项目，例如 ANKI"}
              className="min-h-10 w-full rounded-md border border-sahara-border bg-sahara-surface py-2 pl-9 pr-3 text-sm text-sahara-text outline-none transition-colors placeholder:text-sahara-text-muted focus:border-sahara-text-muted focus:ring-2 focus:ring-sahara-focus disabled:cursor-not-allowed disabled:opacity-55"
            />
          </div>

          {selectedTask && (
            <p className="mt-2 text-xs text-sahara-text-secondary">
              已选择：<span className="font-medium text-sahara-text">{selectedTask.project ? `${selectedTask.project} · ` : ""}{selectedTask.name}</span>
            </p>
          )}

          {normalizedSearchQuery ? (
            <div
              role="listbox"
              aria-label="匹配的任务"
              className="mt-2 max-h-52 overflow-y-auto rounded-md border border-sahara-border bg-sahara-surface p-1"
            >
              {matchingTasks.length === 0 ? (
                <p className="px-2.5 py-3 text-xs text-sahara-text-secondary">
                  没有匹配的未归档任务，请换一个关键词。
                </p>
              ) : (
                <>
                  {sameDayMatchingTasks.length > 0 && (
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-sahara-text-secondary">
                      同一天任务
                    </p>
                  )}
                  {sameDayMatchingTasks.map((task) => renderTaskOption(task))}
                  {otherMatchingTasks.length > 0 && (
                    <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium text-sahara-text-secondary">
                      其他匹配任务
                    </p>
                  )}
                  {otherMatchingTasks.map((task) => renderTaskOption(task))}
                </>
              )}
            </div>
          ) : !selectedTask && targetTasks.length > 0 ? (
            <p className="mt-2 text-xs text-sahara-text-secondary">
              输入任务名或项目名，最多显示 8 个匹配结果。
            </p>
          ) : null}
        </div>

        <p className="mt-3 text-xs leading-5 text-sahara-text-secondary">
          时段和时长保持不变；分类与任务番茄数会随新任务同步更新。
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-[#b42318]/8 px-3 py-2 text-xs leading-5 text-[#982018]">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            intent="default"
            size="sm"
            disabled={saving}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            variant="solid"
            intent="sahara"
            size="sm"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {saving ? "正在更正…" : "保存归属"}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
