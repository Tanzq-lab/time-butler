import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { isTaskDone } from "@/features/tasks/task-completion";
import type { Task } from "@/features/tasks/task-types";

interface TaskItemProps {
  task: Task;
  isActive: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

export function TaskItem({
  task,
  isActive,
  onToggle,
  onDelete,
  onSelect,
}: TaskItemProps) {
  const isComplete = isTaskDone(task);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
        isActive
          ? "bg-sahara-primary-light border border-sahara-primary/30"
          : "hover:bg-sahara-card",
      )}
    >
      <button
        aria-label={isComplete ? `取消完成：${task.name}` : `完成任务：${task.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          isComplete
            ? "border-sahara-primary bg-sahara-primary text-sahara-bg"
            : "border-sahara-border/40",
        )}
      >
        {isComplete && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>

      <button
        type="button"
        aria-pressed={isActive}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
      >
        <Text
          variant="body"
          className={cn(
            "truncate",
            isComplete && "line-through text-sahara-text-muted",
          )}
        >
          {task.name}
        </Text>
        <span className="shrink-0 text-xs text-sahara-text-secondary tabular-nums">
          {task.completed_pomos}/{task.estimated_pomos}
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`删除任务：${task.name}`}
        className="shrink-0 text-sahara-text-muted opacity-0 hover:text-sahara-text group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}
