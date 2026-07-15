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
} from "lucide-react";
import { useState } from "react";
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
  onEdit: () => void;
  onDelete: () => void;
  onCompleteTask: () => void;
  isScheduled?: boolean;
  layout?: "list" | "grid";
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
  onEdit,
  onDelete,
  onCompleteTask,
  isScheduled = false,
  layout = "list",
}: TaskListCardProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDone = isTaskDone(task);
  const canActivate = !isDone && !isScheduled;

  return (
    <article
      className={cn(
        "group relative border border-sahara-border bg-sahara-surface transition-[border-color,background-color,opacity] duration-150",
        layout === "grid" ? "rounded-[10px] p-4" : "rounded-md px-3 py-2.5 md:px-4",
        isDone
          ? "opacity-65 hover:opacity-90"
          : isScheduled
            ? "border-amber-300/60"
          : "hover:border-sahara-text-muted",
        isActive && !isDone &&
          "border-sahara-text-muted bg-sahara-card",
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span
          className={cn(
            "rounded-md bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-muted",
            isActive ? "bg-sahara-surface text-sahara-text" : "",
          )}
        >
          {task.project || "通用"}
        </span>
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
          onClick={onToggleActive}
          className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-surface"
        >
          <span className="block text-sm font-medium leading-snug text-sahara-text md:text-base">{task.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-sahara-text-secondary">
              <Target className="size-3.5" />
              <span className="font-mono tabular-nums">{task.completed_pomos}/{task.estimated_pomos}</span> 个番茄
            </span>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-sahara-text">
                <Clock className="size-3.5" />进行中
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
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-sahara-card">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200",
              isDone ? "bg-green-500" : "bg-sahara-primary",
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
