import {
  CalendarClock,
  Target,
  Clock,
  CheckCircle2,
  CircleCheckBig,
  Trash2,
  Edit3,
  Play,
  MoreHorizontal,
  NotebookPen,
  GripVertical,
} from "lucide-react";
import { useState } from "react";
import type { PointerEvent } from "react";
import type { Task } from "@/features/tasks/task-types";
import { isTaskDone } from "@/features/tasks/task-completion";
import { cn } from "@/lib/cn";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";

interface TaskListCardProps {
  task: Task;
  isActive: boolean;
  onToggleActive: () => void;
  onFocus?: () => void;
  onRecord?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCompleteTask: () => void;
  isScheduled?: boolean;
  layout?: "list" | "grid";
  reorderable?: boolean;
  dragging?: boolean;
  dropIndicator?: "before" | "after" | null;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
}

function formatScheduledFor(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function TaskListCard({
  task,
  isActive,
  onToggleActive,
  onFocus,
  onRecord,
  onEdit,
  onDelete,
  onCompleteTask,
  isScheduled = false,
  layout = "list",
  reorderable = false,
  dragging = false,
  dropIndicator = null,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TaskListCardProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDone = isTaskDone(task);
  const canActivate = !isDone && !isScheduled;
  const progressState = canActivate
    ? task.completed_pomos > task.estimated_pomos
      ? "overrun"
      : "on-track"
    : null;
  const overrunPomos = Math.max(
    0,
    task.completed_pomos - task.estimated_pomos,
  );
  const progressStatusLabel = progressState === "overrun"
    ? `超额 ${overrunPomos} 个`
    : progressState === "on-track"
      ? "正常进度"
      : null;
  const progressAriaText = `${task.completed_pomos}/${task.estimated_pomos} 个番茄${
    progressStatusLabel ? `，${progressStatusLabel}` : ""
  }`;

  return (
    <article
      data-task-id={task.id}
      data-progress-state={progressState ?? undefined}
      onPointerDown={reorderable ? onPointerDown : undefined}
      onPointerMove={reorderable ? onPointerMove : undefined}
      onPointerUp={reorderable ? onPointerUp : undefined}
      onPointerCancel={reorderable ? onPointerCancel : undefined}
      className={cn(
        "group relative border border-sahara-border bg-sahara-surface transition-[border-color,background-color,box-shadow,opacity,transform] duration-150 motion-reduce:transition-none",
        layout === "grid" ? "rounded-[10px] p-4" : "rounded-md px-3 py-2.5 md:px-4",
        isDone
          ? "opacity-65 hover:opacity-90"
          : isScheduled
            ? "border-amber-300/60"
          : "hover:border-sahara-text-muted",
        isActive && !isDone &&
          "border-sahara-text-muted bg-sahara-card",
        reorderable && "cursor-grab select-none hover:bg-sahara-card/35",
        dragging && "cursor-grabbing rounded-lg bg-sahara-surface shadow-lg ring-1 ring-sahara-primary/25",
        dropIndicator && "bg-sahara-card/50",
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
      {progressState && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full",
            progressState === "overrun"
              ? "bg-red-500 dark:bg-red-400"
              : "bg-emerald-500 dark:bg-emerald-400",
          )}
        />
      )}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {reorderable && (
            <span
              aria-hidden="true"
              title="按住任务空白处或点阵拖动调整顺序"
              className="flex shrink-0 items-center justify-center rounded-md p-1 text-sahara-text-muted/80"
            >
              <GripVertical className="size-4" />
            </span>
          )}
          <span
            className={cn(
              "rounded-md bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-muted",
              isActive ? "bg-sahara-surface text-sahara-text" : "",
            )}
          >
            {task.project || "通用"}
          </span>
        </div>
        <div className="hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 md:flex md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          {!isDone && !isScheduled && (
            <>
              {onFocus && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocus();
                  }}
                  aria-label={`开始专注：${task.name}`}
                  className="group/play rounded-md p-1.5 text-sahara-text-muted transition-colors hover:bg-sahara-card hover:text-sahara-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
                  title="开始专注"
                >
                  <Play className="size-3.5 fill-current" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCompleteTask();
                }}
                aria-label={`完成任务：${task.name}`}
                className="rounded-md p-1.5 text-sahara-text-muted transition-colors hover:bg-sahara-card hover:text-sahara-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
                title="完成任务"
              >
                <CircleCheckBig className="size-3.5" />
              </button>
            </>
          )}
          {!isDone && onRecord && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRecord();
              }}
              aria-label={`记录任务：${task.name}`}
              className="rounded-md p-1.5 text-sahara-text-muted transition-colors hover:bg-sahara-card hover:text-sahara-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
              title="记录任务"
            >
              <NotebookPen className="size-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label={`编辑任务：${task.name}`}
            className="rounded-md p-1.5 text-sahara-text-muted transition-colors hover:bg-sahara-card hover:text-sahara-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
            title="编辑任务"
          >
            <Edit3 className="size-3.5 text-sahara-text-muted hover:text-sahara-text" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={`删除任务：${task.name}`}
            className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/30"
            title="删除任务"
          >
            <Trash2 className="size-3.5 text-red-400" />
          </button>
        </div>
        <button
          type="button"
          aria-label={`更多操作：${task.name}`}
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-md p-1.5 text-sahara-text-secondary outline-none hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus md:hidden"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </button>
      </div>

      {canActivate ? (
        <button
          type="button"
          aria-pressed={isActive}
          aria-label={`${task.name} ${progressAriaText}`}
          onClick={onToggleActive}
          className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-surface"
        >
          <span className="block text-sm font-medium leading-snug text-sahara-text md:text-base">{task.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                progressState === "overrun"
                  ? "text-red-700 dark:text-red-300"
                  : "text-emerald-700 dark:text-emerald-300",
              )}
            >
              <Target aria-hidden="true" className="size-3.5" />
              <span className="font-mono tabular-nums">{task.completed_pomos}/{task.estimated_pomos}</span> 个番茄
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                progressState === "overrun"
                  ? "bg-red-50 text-red-700 ring-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/80"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/80",
              )}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {progressStatusLabel}
            </span>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-sahara-text">
                <Clock aria-hidden="true" className="size-3.5" />进行中
              </span>
            )}
          </span>
        </button>
      ) : (
        <h3 className={cn("text-sm font-medium leading-snug md:text-base", isDone ? "text-sahara-text-muted line-through" : "text-sahara-text")}>{task.name}</h3>
      )}

      {isDone && task.completion_review && (
        <div className="mt-2 max-h-20 overflow-hidden border-l-2 border-sahara-border pl-3">
          <MarkdownRenderer
            content={task.completion_review}
            variant="compact"
            className="text-xs md:text-sm"
          />
        </div>
      )}

      {!canActivate && <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-sahara-text-secondary">
          <Target className="size-3 md:w-3.5 md:h-3.5 text-sahara-primary" />
          <span className="font-mono tabular-nums">
            {task.completed_pomos}/{task.estimated_pomos}{" "}
            <span className="font-sans text-sahara-text-muted">
              个番茄
            </span>
          </span>
        </div>

        {isScheduled && task.scheduled_for && (
          <div className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <CalendarClock className="size-2.5 md:w-3 md:h-3" />
            {formatScheduledFor(task.scheduled_for)}
          </div>
        )}

        {isDone && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-muted">
            <CheckCircle2 className="size-2.5 md:w-3 md:h-3" />
            已完成
          </span>
        )}
      </div>}

      {task.estimated_pomos > 0 && (
        <div
          role="progressbar"
          aria-label={`${task.name} 任务进度`}
          aria-valuemin={0}
          aria-valuemax={task.estimated_pomos}
          aria-valuenow={Math.min(task.completed_pomos, task.estimated_pomos)}
          aria-valuetext={progressAriaText}
          className="mt-2 h-1 overflow-hidden rounded-full bg-sahara-card"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none",
              isDone
                ? "bg-green-500"
                : progressState === "overrun"
                  ? "bg-red-500 dark:bg-red-400"
                  : progressState === "on-track"
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-sahara-primary",
            )}
            style={{
              width: `${Math.min(
                100,
                Math.round(
                  (task.completed_pomos / task.estimated_pomos) * 100,
                ),
              )}%`,
            }}
          />
        </div>
      )}

      <ModalOverlay
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="bottom"
        maxWidth="max-w-md"
        ariaLabel={`任务操作：${task.name}`}
        showCloseButton
      >
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
          <p className="pr-10 text-sm font-semibold text-sahara-text">{task.name}</p>
          <div className="mt-4 space-y-1">
            {!isDone && !isScheduled && onFocus && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => {
                  setMobileMenuOpen(false);
                  onFocus();
                }}
                className="justify-start gap-3 px-3 py-3"
              >
                <Play aria-hidden="true" className="size-4" />
                开始专注
              </Button>
            )}
            {!isDone && !isScheduled && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => {
                  setMobileMenuOpen(false);
                  onCompleteTask();
                }}
                className="justify-start gap-3 px-3 py-3"
              >
                <CircleCheckBig aria-hidden="true" className="size-4" />
                完成任务
              </Button>
            )}
            {!isDone && onRecord && (
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => {
                  setMobileMenuOpen(false);
                  onRecord();
                }}
                className="justify-start gap-3 px-3 py-3"
              >
                <NotebookPen aria-hidden="true" className="size-4" />
                记录任务
              </Button>
            )}
            <Button
              variant="ghost"
              intent="default"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                onEdit();
              }}
              className="justify-start gap-3 px-3 py-3"
            >
              <Edit3 aria-hidden="true" className="size-4" />
              编辑任务
            </Button>
            <Button
              variant="ghost"
              intent="red"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                onDelete();
              }}
              className="justify-start gap-3 px-3 py-3"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              删除任务
            </Button>
          </div>
        </div>
      </ModalOverlay>
    </article>
  );
}
