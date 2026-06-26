import {
  CalendarClock,
  Target,
  Clock,
  CheckCircle2,
  CircleCheckBig,
  Trash2,
  Edit3,
  Play,
} from "lucide-react";
import type { Task } from "@/features/tasks/task-types";
import { isTaskDone } from "@/features/tasks/task-completion";
import { cn } from "@/lib/cn";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface TaskListCardProps {
  task: Task;
  isActive: boolean;
  onToggleActive: () => void;
  onFocus?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCompleteTask: () => void;
  isScheduled?: boolean;
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
}: TaskListCardProps) {
  const isDone = isTaskDone(task);
  const canActivate = !isDone && !isScheduled;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => canActivate && onToggleActive()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && canActivate) {
          e.preventDefault();
          onToggleActive();
        }
      }}
      className={cn(
        "group relative bg-sahara-surface border border-sahara-border/15 rounded-xl md:rounded-2xl p-3.5 md:p-5 transition-all",
        canActivate ? "cursor-pointer" : "cursor-default",
        isDone
          ? "opacity-60 hover:opacity-80 border-sahara-border/10"
          : isScheduled
            ? "border-amber-200/60 bg-amber-50/30"
          : "hover:border-sahara-primary/25 hover:shadow-sm",
        isActive && !isDone &&
          "border-sahara-primary shadow-lg shadow-sahara-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2 md:mb-3">
        <span
          className={cn(
            "px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold uppercase tracking-wider",
            isActive
              ? "bg-sahara-primary-light text-sahara-primary"
              : "bg-sahara-card text-sahara-text-muted",
          )}
        >
          {task.project || "通用"}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!isDone && !isScheduled && (
            <>
              {onFocus && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocus();
                  }}
                  className="p-1 rounded-lg hover:bg-sahara-primary/10 transition-colors cursor-pointer group/play"
                  title="开始专注"
                >
                  <Play className="size-3.5 text-sahara-primary fill-sahara-primary group-hover/play:scale-110 transition-transform" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCompleteTask();
                }}
                className="p-1 rounded-lg hover:bg-sahara-card transition-colors cursor-pointer"
                title="完成任务"
              >
                <CircleCheckBig className="size-3.5 text-sahara-primary" />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded-lg hover:bg-sahara-card transition-colors cursor-pointer"
            title="编辑任务"
          >
            <Edit3 className="size-3.5 text-sahara-text-muted hover:text-sahara-text" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            title="删除任务"
          >
            <Trash2 className="size-3.5 text-red-400" />
          </button>
        </div>
      </div>

      <h3
        className={cn(
          "font-serif text-base md:text-lg leading-snug",
          isDone
            ? "line-through text-sahara-text-muted"
            : "text-sahara-text",
        )}
      >
        {task.name}
      </h3>

      {isDone && task.completion_review && (
        <div className="mt-2 max-h-20 overflow-hidden rounded-xl border border-sahara-border/10 bg-sahara-bg/35 px-3 py-2">
          <MarkdownRenderer
            content={task.completion_review}
            variant="compact"
            className="text-xs md:text-sm"
          />
        </div>
      )}

      <div className="flex items-center gap-3 mt-2 md:mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Target className="size-3 md:w-3.5 md:h-3.5 text-sahara-primary" />
          <span className="text-[10px] md:text-xs font-bold text-sahara-text-secondary tabular-nums">
            {task.completed_pomos}/{task.estimated_pomos}{" "}
            <span className="text-sahara-text-muted font-normal">
              个番茄
            </span>
          </span>
        </div>

        {isActive && !isDone && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
            <Clock className="size-2.5 md:w-3 md:h-3 animate-pulse" />
            进行中
          </div>
        )}

        {isScheduled && task.scheduled_for && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] md:text-[10px] font-bold tracking-wider">
            <CalendarClock className="size-2.5 md:w-3 md:h-3" />
            {formatScheduledFor(task.scheduled_for)}
          </div>
        )}

        {isDone && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sahara-bg text-sahara-text-muted text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="size-2.5 md:w-3 md:h-3" />
            已完成
          </span>
        )}
      </div>

      {task.estimated_pomos > 0 && (
        <div className="mt-2 md:mt-3 h-1.5 bg-sahara-bg/60 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
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
    </div>
  );
}
