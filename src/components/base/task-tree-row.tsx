import { useEffect, useState, type PointerEvent } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Focus,
  GripVertical,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Task } from "@/features/tasks/task-types";
import { getTaskItemType } from "@/features/tasks/task-types";
import type { TaskPomoRingTone } from "@/lib/task-pomo-progress";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!editing) setEditingName(task.name);
  }, [editing, task.name]);

  const commitRename = async () => {
    const cleanName = editingName.trim();
    if (!cleanName) return;
    const saved = await onRename(cleanName);
    if (saved !== false) setEditing(false);
  };

  const openAction = (action?: () => void) => {
    setMobileMenuOpen(false);
    action?.();
  };

  return (
    <>
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
          completed && !isGroup && "opacity-65 hover:opacity-90",
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
            "flex min-w-0 items-start gap-2.5 py-2.5",
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
            ) : isFocus ? (
              <span
                aria-hidden="true"
                className={cn(
                  "task-pomo-tone task-pomo-mark flex size-6 items-center justify-center rounded-full border-[1.5px]",
                  focusPomoToneClassName,
                )}
              >
                {completed ? (
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={2.75} />
                ) : (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                )}
              </span>
            ) : (
              <button
                type="button"
                role="checkbox"
                aria-checked={completed}
                aria-label={completed ? `恢复待办：${task.name}` : `完成待办：${task.name}`}
                onClick={onToggleTodo}
                className="flex size-10 touch-manipulation items-center justify-center self-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus md:size-8"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-[5px] border transition-[background-color,border-color,color,transform] duration-150 active:scale-95 motion-reduce:transform-none",
                    completed
                      ? "border-sahara-primary bg-sahara-primary text-sahara-bg"
                      : "border-sahara-text-muted/55 bg-sahara-surface text-transparent hover:border-sahara-text",
                  )}
                >
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editing ? (
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
                  <p
                    className={cn(
                      "min-w-0 truncate text-sm leading-6 text-sahara-text",
                      isGroup && "font-semibold",
                      completed && !isGroup && "text-sahara-text-muted line-through decoration-sahara-text-muted/55",
                      completed && isGroup && "text-sahara-text-secondary",
                    )}
                    title={task.name}
                  >
                    {task.name}
                  </p>
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

          {!editing && (
            <div className="flex shrink-0 items-center gap-0.5">
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

              <div className="pointer-events-none hidden items-center gap-0.5 opacity-0 transition-opacity duration-150 md:flex md:group-hover/task:pointer-events-auto md:group-hover/task:opacity-100 md:group-focus-within/task:pointer-events-auto md:group-focus-within/task:opacity-100">
                {canAddSubtask && onAddSubtask && (
                  <button
                    type="button"
                    onClick={onAddSubtask}
                    aria-label={`添加子任务：${task.name}`}
                    title="添加子任务"
                    className="flex size-8 items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                  </button>
                )}
                {reorderable && (
                  <span
                    aria-hidden="true"
                    title="按住任务空白处或点阵拖动调整顺序"
                    className="flex size-8 items-center justify-center rounded-md text-sahara-text-muted/80"
                  >
                    <GripVertical aria-hidden="true" className="size-4" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label={`更多操作：${task.name}`}
                  title="更多操作"
                  className="flex size-8 items-center justify-center rounded-md text-sahara-text-muted outline-none hover:bg-sahara-surface hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label={`更多操作：${task.name}`}
                className="flex size-10 items-center justify-center rounded-md text-sahara-text-secondary outline-none hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus md:hidden"
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}
        </div>
      </article>

      <ModalOverlay
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="responsive"
        maxWidth="max-w-md"
        ariaLabel={`任务操作：${task.name}`}
        showCloseButton
      >
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
          <p className="pr-10 text-sm font-semibold text-sahara-text">{task.name}</p>
          <div className="mt-4 space-y-1">
            {canAddSubtask && onAddSubtask && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => openAction(onAddSubtask)}
                className="justify-start gap-3 px-3 py-3"
              >
                <Plus aria-hidden="true" className="size-4" />
                添加子任务
              </Button>
            )}
            {isFocus && !completed && onFocus && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => openAction(onFocus)}
                className="justify-start gap-3 px-3 py-3"
              >
                <Play aria-hidden="true" className="size-4 fill-current" />
                {runtimeStatus ? "回到专注" : "开始专注"}
              </Button>
            )}
            {isFocus && !completed && onRecord && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => openAction(onRecord)}
                className="justify-start gap-3 px-3 py-3"
              >
                <NotebookPen aria-hidden="true" className="size-4" />
                记录
              </Button>
            )}
            <Button
              variant="ghost"
              intent="default"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                if (onEditDetails) onEditDetails();
                else setEditing(true);
              }}
              className="justify-start gap-3 px-3 py-3"
            >
              <Pencil aria-hidden="true" className="size-4" />
              编辑名称
            </Button>
            {!isGroup && !completed && (
              isFocus ? (
                <>
                  {onCompleteFocus && (
                    <Button
                      variant="ghost"
                      intent="default"
                      fullWidth
                      onClick={() => openAction(onCompleteFocus)}
                      className="justify-start gap-3 px-3 py-3"
                    >
                      <CircleCheckBig aria-hidden="true" className="size-4" />
                      完成任务
                    </Button>
                  )}
                  {onConvertToTodo && (
                    <Button
                      variant="ghost"
                      intent="default"
                      fullWidth
                      onClick={() => openAction(onConvertToTodo)}
                      className="justify-start gap-3 px-3 py-3"
                    >
                      <CheckCircle2 aria-hidden="true" className="size-4" />
                      改为普通待办
                    </Button>
                  )}
                </>
              ) : onConvertToFocus ? (
                <Button
                  variant="ghost"
                  intent="default"
                  fullWidth
                  onClick={() => openAction(onConvertToFocus)}
                  className="justify-start gap-3 px-3 py-3"
                >
                  <Focus aria-hidden="true" className="size-4" />
                  设为专注任务
                </Button>
              ) : null
            )}
            {completed && !isGroup && onToggleTodo && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => openAction(onToggleTodo)}
                className="justify-start gap-3 px-3 py-3"
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                重新打开
              </Button>
            )}
            <Button
              variant="ghost"
              intent="red"
              fullWidth
              onClick={() => openAction(onDelete)}
              className="justify-start gap-3 px-3 py-3"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              删除
            </Button>
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
