import { useEffect, useState, type PointerEvent } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Focus,
  ListTodo,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Task } from "@/features/tasks/task-types";
import { getTaskItemType } from "@/features/tasks/task-types";
import type { TaskPomoRingTone } from "@/lib/task-pomo-progress";
import { cn } from "@/lib/cn";

interface TaskTreeRowProps {
  task: Task;
  childCount?: number;
  completedChildCount?: number;
  expanded?: boolean;
  depth?: 0 | 1;
  categoryName?: string | null;
  isActive?: boolean;
  runtimeStatus?: "running" | "paused" | null;
  reorderable?: boolean;
  dragging?: boolean;
  dropIndicator?: "before" | "after" | null;
  canAddSubtask?: boolean;
  onToggleExpanded?: () => void;
  onToggleTodo?: () => void;
  onFocus?: () => void;
  onCompleteFocus?: () => void;
  onConvertToFocus?: () => void;
  onConvertToTodo?: () => void;
  onAddSubtask?: () => void;
  onRename: (name: string) => Promise<boolean> | boolean;
  onEditDetails?: () => void;
  onRecord?: () => void;
  onDelete: () => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
}

type FocusPomoTone = "not-started" | "complete" | TaskPomoRingTone;

const BUDGET_TONES: Exclude<TaskPomoRingTone, "overrun">[] = [
  "start",
  "progress",
  "caution",
  "final-in-budget",
];

const POMO_TONE_CLASS_NAMES: Record<FocusPomoTone, string> = {
  "not-started": "task-pomo-not-started",
  "complete": "task-pomo-complete",
  "start": "timer-task-pomo-start",
  "progress": "timer-task-pomo-progress",
  "caution": "timer-task-pomo-caution",
  "final-in-budget": "timer-task-pomo-final-in-budget",
  "overrun": "timer-task-pomo-overrun",
};

function getFocusPomoTone(task: Task, completed: boolean): FocusPomoTone {
  if (completed) return "complete";

  const completedPomos = Math.max(0, Math.floor(task.completed_pomos));
  const estimatedPomos = Math.max(0, Math.floor(task.estimated_pomos));
  if (completedPomos === 0 || estimatedPomos === 0) return "not-started";
  if (completedPomos > estimatedPomos) return "overrun";
  if (completedPomos === estimatedPomos || estimatedPomos === 1) {
    return "final-in-budget";
  }

  const budgetPosition = (completedPomos - 1) / (estimatedPomos - 1);
  const toneIndex = Math.round(
    budgetPosition * (BUDGET_TONES.length - 1),
  );
  return BUDGET_TONES[toneIndex];
}

function formatScheduledFor(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function TaskTreeRow({
  task,
  childCount = 0,
  completedChildCount = 0,
  expanded = false,
  depth = 0,
  categoryName,
  isActive = false,
  runtimeStatus = null,
  reorderable = false,
  dragging = false,
  dropIndicator = null,
  canAddSubtask = depth === 0,
  onToggleExpanded,
  onToggleTodo,
  onFocus,
  onCompleteFocus,
  onConvertToFocus,
  onConvertToTodo,
  onAddSubtask,
  onRename,
  onEditDetails,
  onRecord,
  onDelete,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TaskTreeRowProps) {
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(task.name);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const isGroup = childCount > 0;
  const isFocus = getTaskItemType(task) === "focus" && !isGroup;
  const completed = Boolean(task.completed_at);
  const focusPomoTone = isFocus ? getFocusPomoTone(task, completed) : null;
  const focusPomoToneClassName = focusPomoTone
    ? POMO_TONE_CLASS_NAMES[focusPomoTone]
    : null;
  const groupProgress = childCount === 0
    ? 0
    : Math.round((completedChildCount / childCount) * 100);
  const groupComplete = childCount > 0 && completedChildCount === childCount;
  const leafCompletionAction = completed
    ? onToggleTodo
    : isFocus
      ? onCompleteFocus
      : onToggleTodo;
  const leafCompletionLabel = completed
    ? isFocus
      ? `重新打开专注任务：${task.name}`
      : `恢复待办：${task.name}`
    : isFocus
      ? `完成专注任务：${task.name}`
      : `完成待办：${task.name}`;

  useEffect(() => {
    if (!editing) setEditingName(task.name);
  }, [editing, task.name]);

  useEffect(() => {
    if (!completed) return;
    setEditing(false);
    setActionsExpanded(false);
  }, [completed]);

  const commitRename = async () => {
    const cleanName = editingName.trim();
    if (!cleanName) return;
    const saved = await onRename(cleanName);
    if (saved !== false) setEditing(false);
  };

  const editTask = () => {
    if (onEditDetails) onEditDetails();
    else setEditing(true);
  };
  const actionPanelId = `task-actions-${task.id}`;
  const taskTitleClassName = cn(
    "min-w-0 truncate text-sm leading-6",
    isGroup && "font-semibold",
    completed ? "text-sahara-text-secondary" : "text-sahara-text",
  );
  const taskTitle = (
    <>
      {isFocus && (
        <span
          className={cn(
            "task-pomo-label font-medium",
            focusPomoToneClassName,
          )}
        >
          专注：
        </span>
      )}
      {task.name}
    </>
  );

  return (
    <article
      data-task-id={task.id}
      data-task-depth={depth}
      data-task-kind={isGroup ? "group" : isFocus ? "focus" : "todo"}
      data-pomo-tone={focusPomoTone ?? undefined}
      onPointerDown={reorderable ? onPointerDown : undefined}
      onPointerMove={reorderable ? onPointerMove : undefined}
      onPointerUp={reorderable ? onPointerUp : undefined}
      onPointerCancel={reorderable ? onPointerCancel : undefined}
      className={cn(
        "group/task relative transition-[background-color,opacity,transform] duration-150 motion-reduce:transition-none",
        depth === 0
          ? isGroup
            ? "bg-sahara-card/55 hover:bg-sahara-card/75"
            : "bg-sahara-surface hover:bg-sahara-card/40"
          : "border-t border-sahara-border/80 bg-sahara-surface hover:bg-sahara-card/35",
        isActive && !completed && "bg-sahara-card/70",
        reorderable && "cursor-grab select-none",
        dragging && "z-20 cursor-grabbing rounded-md bg-sahara-surface shadow-lg ring-1 ring-sahara-primary/25",
        dropIndicator && "bg-sahara-card/60",
      )}
    >
      {dropIndicator === "before" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 rounded-full bg-sahara-primary"
        />
      )}
      {dropIndicator === "after" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-0.5 rounded-full bg-sahara-primary"
        />
      )}

      <div
        className={cn(
          "flex min-w-0 flex-wrap items-start gap-x-2.5 py-2.5 md:flex-nowrap",
          depth === 0 ? "px-3 sm:px-4" : "px-2.5 sm:px-3",
          isGroup && "py-3",
        )}
      >
          <div className="flex h-10 shrink-0 items-center md:h-8">
            {isGroup ? (
              <button
                type="button"
                onClick={onToggleExpanded}
                aria-expanded={expanded}
                aria-label={`${expanded ? "收起" : "展开"}：${task.name}`}
                className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-secondary outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" className="size-4" />
                ) : (
                  <ChevronRight aria-hidden="true" className="size-4" />
                )}
              </button>
            ) : (
              <button
                type="button"
                role="checkbox"
                aria-checked={completed}
                aria-label={leafCompletionLabel}
                onClick={leafCompletionAction}
                disabled={!leafCompletionAction}
                className="flex size-10 touch-manipulation items-center justify-center self-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-[5px] border transition-transform duration-150 active:scale-95 motion-reduce:transform-none",
                    completed
                      ? "border-[var(--color-timer-complete)] bg-[var(--color-timer-complete)] text-sahara-bg"
                      : "border-sahara-text-muted/55 bg-sahara-surface text-transparent hover:border-sahara-text",
                  )}
                >
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editing && !completed ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={editingName}
                  aria-label={`编辑任务：${task.name}`}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitRename();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditing(false);
                    }
                  }}
                  className="h-8 min-w-0 flex-1 rounded-md border border-sahara-border bg-sahara-surface px-2.5 text-sm text-sahara-text outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
                />
                <button
                  type="button"
                  onClick={() => void commitRename()}
                  disabled={!editingName.trim()}
                  aria-label={`保存任务名称：${task.name}`}
                  className="flex size-8 items-center justify-center rounded-md text-sahara-text-secondary outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus disabled:pointer-events-none disabled:opacity-40"
                >
                  <Check aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  aria-label={`取消编辑：${task.name}`}
                  className="flex size-8 items-center justify-center rounded-md text-sahara-text-secondary outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  {completed ? (
                    <p className={taskTitleClassName} title={task.name}>
                      {taskTitle}
                    </p>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={actionsExpanded}
                      aria-controls={actionPanelId}
                      aria-label={`${actionsExpanded ? "收起" : "显示"}任务操作：${task.name}`}
                      onClick={() => setActionsExpanded((value) => !value)}
                      className={cn(
                        taskTitleClassName,
                        "rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus",
                      )}
                      title={task.name}
                    >
                      {taskTitle}
                    </button>
                  )}
                  {runtimeStatus && !completed && (
                    <span
                      role="status"
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        runtimeStatus === "running" ? "bg-blue-500" : "bg-amber-500",
                      )}
                      title={runtimeStatus === "running" ? "专注进行中" : "专注已暂停"}
                      aria-label={runtimeStatus === "running" ? "专注进行中" : "专注已暂停"}
                    />
                  )}
                </div>

                {isGroup && (
                  <div className="mt-2 flex max-w-lg items-center gap-3">
                    <div
                      role="progressbar"
                      aria-label={`${task.name} 子任务进度`}
                      aria-valuemin={0}
                      aria-valuemax={childCount}
                      aria-valuenow={completedChildCount}
                      aria-valuetext={`${completedChildCount}/${childCount} 个子任务`}
                      className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-sahara-border/80"
                    >
                      <div
                        className={cn(
                          "h-full origin-left rounded-full transition-[transform,background-color] duration-200 motion-reduce:transition-none",
                          groupComplete
                            ? "bg-[var(--color-timer-complete)]"
                            : "bg-sahara-primary",
                        )}
                        style={{ transform: `scaleX(${groupProgress / 100})` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[11px] font-semibold tabular-nums",
                        groupComplete
                          ? "text-[var(--color-timer-complete)]"
                          : "text-sahara-text-secondary",
                      )}
                    >
                      {completedChildCount}/{childCount}
                    </span>
                  </div>
                )}

                {isFocus && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-sahara-text-secondary">
                    <span
                      aria-label={`番茄进度 ${task.completed_pomos}/${task.estimated_pomos}`}
                      className={cn(
                        "task-pomo-label font-mono font-semibold tabular-nums",
                        focusPomoToneClassName,
                      )}
                    >
                      {task.completed_pomos}/{task.estimated_pomos}
                    </span>
                    {task.scheduled_for && (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                        <CalendarClock aria-hidden="true" className="size-3" />
                        {formatScheduledFor(task.scheduled_for)}
                      </span>
                    )}
                    {categoryName && (
                      <span className="max-w-32 truncate" title={categoryName}>
                        {categoryName}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

        {!editing && !completed && (
          <div
            id={actionPanelId}
            role="group"
            aria-label={`任务操作：${task.name}`}
            className={cn(
              "order-last ml-auto mt-0.5 w-full items-center justify-end gap-0.5 md:order-none md:mt-0 md:flex md:w-auto md:shrink-0",
              actionsExpanded ? "flex" : "hidden",
            )}
          >
            {isFocus && !completed && onFocus && (
              <button
                type="button"
                onClick={onFocus}
                aria-label={`${runtimeStatus ? "回到专注" : "开始专注"}：${task.name}`}
                title={runtimeStatus ? "回到专注" : "开始专注"}
                className={cn(
                  "flex size-10 touch-manipulation items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8",
                  runtimeStatus === "running"
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/35 dark:text-blue-300 dark:hover:bg-blue-950/55"
                    : runtimeStatus === "paused"
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/35 dark:text-amber-300 dark:hover:bg-amber-950/55"
                      : "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
                )}
              >
                <Play aria-hidden="true" className="size-3.5 fill-current" />
              </button>
            )}

            <div className="flex items-center gap-0.5 md:pointer-events-none md:opacity-0 md:transition-opacity md:duration-150 md:group-hover/task:pointer-events-auto md:group-hover/task:opacity-100 md:group-focus-within/task:pointer-events-auto md:group-focus-within/task:opacity-100 motion-reduce:transition-none">
              {canAddSubtask && onAddSubtask && (
                <button
                  type="button"
                  onClick={onAddSubtask}
                  aria-label={`添加子任务：${task.name}`}
                  title="添加子任务"
                  className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                </button>
              )}

              {isFocus && !completed && onRecord && (
                <button
                  type="button"
                  onClick={onRecord}
                  aria-label={`记录任务：${task.name}`}
                  title="记录"
                  className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
                >
                  <NotebookPen aria-hidden="true" className="size-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={editTask}
                aria-label={`编辑任务：${task.name}`}
                title="编辑"
                className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
              >
                <Pencil aria-hidden="true" className="size-3.5" />
              </button>

              {!isGroup
                && !completed
                && isFocus
                && task.completed_pomos === 0
                && onConvertToTodo
                && (
                  <button
                    type="button"
                    onClick={onConvertToTodo}
                    aria-label={`改为普通待办：${task.name}`}
                    title="改为普通待办"
                    className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
                  >
                    <ListTodo aria-hidden="true" className="size-3.5" />
                  </button>
                )}

              {!isGroup && !completed && !isFocus && onConvertToFocus && (
                <button
                  type="button"
                  onClick={onConvertToFocus}
                  aria-label={`设为专注任务：${task.name}`}
                  title="设为专注任务"
                  className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
                >
                  <Focus aria-hidden="true" className="size-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onDelete}
                aria-label={`删除任务：${task.name}`}
                title="删除"
                className="flex size-10 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 md:size-8"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
