import { useState } from "react";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskFilter } from "@/features/tasks/use-task-filter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ListTodo } from "lucide-react";
import { cn } from "@/lib/cn";
import { ModalOverlay } from "@/components/ui/modal-overlay";

interface TaskSelectorProps {
  disabled?: boolean;
}

export function TaskSelector({ disabled = false }: TaskSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const tasks = useTaskStore((s) => s.tasks);
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const setActiveTask = useTimerStore((s) => s.setActiveTask);

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // Use the standard task filter to get active tasks
  const { active: availableTasks } = useTaskFilter(tasks, searchQuery);

  const handleSelect = (taskId: number | null) => {
    setActiveTask(taskId);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <Button
        variant="outline"
        intent={activeTask ? "sahara" : "default"}
        size="sm"
        shape="rounded-full"
        active={!!activeTask}
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        aria-pressed={!!activeTask}
        title={activeTask?.name}
        className={cn(
          "min-w-0 max-w-48 gap-1.5 text-left sm:max-w-56 md:max-w-62.5",
          !activeTask &&
            "border border-sahara-border bg-sahara-surface hover:bg-sahara-card",
        )}
      >
        {activeTask ? (
          <>
            <CheckCircle2 className="size-3.5 shrink-0 text-current" />
            <span className="truncate text-xs font-semibold text-current">
              {activeTask.name}
            </span>
            <ChevronDown className="size-3 shrink-0 text-current opacity-65" />
          </>
        ) : (
          <>
            <ListTodo className="size-3.5 shrink-0 text-sahara-text-secondary" />
            <span className="truncate text-[11px] font-medium text-sahara-text-secondary">
              选择任务
            </span>
            <ChevronDown className="size-3 shrink-0 text-sahara-text-secondary" />
          </>
        )}
      </Button>

      <ModalOverlay open={isOpen} onClose={() => setIsOpen(false)} showCloseButton>
        <div className="px-6 py-5 border-b border-sahara-border/20">
          <h2 className="text-xl font-semibold text-sahara-text">
            选择任务
          </h2>
        </div>

        <div className="px-6 pt-5 pb-3">
          <div className="relative">
            <input
              type="text"
              name="active-task-search"
              autoComplete="off"
              aria-label="搜索进行中的任务"
              placeholder="搜索进行中的任务…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-sahara-border bg-sahara-surface px-4 py-3 text-sm font-medium outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
            />
          </div>
        </div>

        <div className="px-6 pb-6 max-h-64 overflow-y-auto">
          <Button
            variant="ghost"
            size="sm"
            intent="default"
            fullWidth
            shape="rounded-xl"
            active={activeTaskId === null}
            onClick={() => handleSelect(null)}
            className={cn(
              "justify-between px-4 py-3 mb-1",
              activeTaskId === null
                ? "bg-sahara-primary-light ring-1 ring-sahara-primary/20"
                : "hover:bg-sahara-card",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full border-2 border-sahara-text-muted shrink-0" />
              <span
                className={cn(
                  "text-sm font-medium",
                  activeTaskId === null
                    ? "font-semibold text-sahara-text"
                    : "text-sahara-text-secondary",
                )}
              >
                不关联任务（独立专注）
              </span>
            </div>
          </Button>

          {availableTasks.map((task) => (
            <Button
              key={task.id}
              variant="ghost"
              size="sm"
              intent="default"
              fullWidth
              shape="rounded-xl"
              active={activeTaskId === task.id}
              onClick={() => handleSelect(task.id)}
              className={cn(
                "justify-between px-4 py-3 mb-1",
                activeTaskId === task.id
                  ? "bg-sahara-primary-light ring-1 ring-sahara-primary/20"
                  : "hover:bg-sahara-card",
              )}
            >
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span
                  className={cn(
                    "text-sm font-medium truncate w-full text-left",
                    activeTaskId === task.id
                      ? "font-semibold text-sahara-text"
                      : "text-sahara-text",
                  )}
                >
                  {task.name}
                </span>
                <span className="text-[10px] text-sahara-text-secondary">
                  {task.completed_pomos} / {task.estimated_pomos} 个番茄
                </span>
              </div>
            </Button>
          ))}

          {availableTasks.length === 0 && searchQuery && (
            <p className="py-6 text-center text-sm text-sahara-text-secondary">
              没有找到匹配的任务
            </p>
          )}
        </div>
      </ModalOverlay>
    </>
  );
}
