import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { ChevronRight, Target } from "lucide-react";

export function TaskList() {
  const tasks = useTaskStore((s) => s.tasks);
  const activeTaskId = useTimerStore((s) => s.activeTaskId);

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  return (
    <div className="w-full">
      {activeTask ? (
        <div className="group flex items-center gap-6 rounded-[10px] border border-sahara-border bg-sahara-surface p-6 transition-colors duration-150 hover:border-sahara-text-muted">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-sahara-card text-sahara-text-secondary">
            <Target aria-hidden="true" className="size-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="truncate text-xl font-semibold text-sahara-text">
              {activeTask.name}
            </h4>
            <p className="mt-1 text-xs font-medium text-sahara-text-secondary">
              项目：{activeTask.project || "通用"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs font-bold text-sahara-primary tabular-nums">
                {activeTask.completed_pomos}
              </span>
              <span className="text-xs font-bold text-sahara-text-muted tabular-nums">
                /{activeTask.estimated_pomos}
              </span>
              <p className="mt-0.5 text-[10px] font-medium text-sahara-text-secondary">
                个番茄
              </p>
            </div>
            <ChevronRight className="size-5 text-sahara-border group-hover:text-sahara-primary transition-colors" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[10px] border border-dashed border-sahara-border bg-sahara-card/50 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-sahara-border bg-sahara-surface text-sahara-text-muted">
            <Target aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-sahara-text-secondary">
              没有专注任务
            </p>
            <p className="text-xs text-sahara-text-muted mt-1">
              从任务页选择一个任务来记录进度
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
