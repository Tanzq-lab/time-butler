import { Target, ChevronRight, Clock } from "lucide-react";
import type { Task } from "@/features/tasks/task-types";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/session-utils";

interface ActiveTaskCardProps {
  task: Task | null;
  taskTimeToday: number;
}

export function ActiveTaskCard({ task, taskTimeToday }: ActiveTaskCardProps) {
  if (!task) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-sahara-border bg-sahara-surface p-4 text-left md:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sahara-card text-sahara-text-secondary">
          <Target aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sahara-text">
            暂无专注任务
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-sahara-text-secondary md:text-sm">
            从任务列表选择一个任务，开始记录进度并保持专注。
          </p>
        </div>
      </div>
    );
  }

  const progressPct =
    task.estimated_pomos > 0
      ? Math.min(
          100,
          Math.round((task.completed_pomos / task.estimated_pomos) * 100),
        )
      : 0;

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-sahara-border bg-sahara-surface p-4 transition-colors duration-150 hover:border-sahara-text-muted md:gap-4 md:p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-sahara-border bg-sahara-card text-sahara-text-secondary md:size-12">
        <Target aria-hidden="true" className="size-5 md:size-6" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold leading-tight text-sahara-text md:text-lg">
              {task.name}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="rounded-md bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-secondary md:text-xs">
                {task.project || "通用"}
              </span>
              {taskTimeToday > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-secondary md:text-xs">
                  <Clock className="size-3 text-sahara-primary" />
                  今日 {formatDuration(taskTimeToday)}
                </span>
              )}
            </div>
          </div>
          <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-sahara-text-muted" />
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="text-xs font-medium text-sahara-text-secondary">
              进度
            </span>
            <span className="text-xs font-semibold tabular-nums text-sahara-text md:text-sm">
              {task.completed_pomos} / {task.estimated_pomos} <span className="ml-1 font-normal text-sahara-text-secondary">个番茄</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sahara-card">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200 ease-out",
                progressPct >= 100 ? "bg-emerald-500" : "bg-sahara-primary",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
