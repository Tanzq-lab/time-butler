import { Pause, Play, Timer } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { cn } from "@/lib/cn";
import { formatSeconds } from "@/lib/time";

interface SidebarTimerStatusProps {
  isCollapsed: boolean;
}

export function SidebarTimerStatus({ isCollapsed }: SidebarTimerStatusProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const phase = useTimerStore((state) => state.phase);
  const status = useTimerStore((state) => state.status);
  const secondsRemaining = useTimerStore((state) => state.secondsRemaining);
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const start = useTimerStore((state) => state.start);
  const pause = useTimerStore((state) => state.pause);
  const resume = useTimerStore((state) => state.resume);
  const tasks = useTaskStore((state) => state.tasks);

  const isActive = status !== "idle";
  const isTimerPage = location.pathname === "/" || location.pathname === "/timer";
  const phaseLabel = phase === "work" ? "专注" : "休息";
  const idleLabel = phase === "work" ? "开始专注" : "开始休息";
  const activeLabel = `${phaseLabel}${status === "paused" ? "已暂停" : "进行中"}`;
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const taskName = activeTask?.name ?? (phase === "work" ? "独立专注" : "休息时间");
  const formattedTime = formatSeconds(secondsRemaining);

  if (!isActive) {
    return (
      <Button
        variant="outline"
        intent="default"
        fullWidth
        onClick={() => {
          if (!isTimerPage) navigate("/");
          void start(undefined, { source: "sidebar" });
        }}
        title={isCollapsed ? idleLabel : undefined}
        aria-label={idleLabel}
        className={cn(
          "h-9 border-sahara-border bg-sahara-surface text-xs font-medium text-sahara-text hover:bg-sahara-card",
          isCollapsed ? "px-0" : "gap-2 px-3",
        )}
      >
        <Play
          aria-hidden="true"
          className={cn("size-4 fill-current", !isCollapsed && "ml-0.5")}
        />
        {!isCollapsed && <span>{idleLabel}</span>}
      </Button>
    );
  }

  if (isTimerPage) {
    return (
      <div
        role="status"
        aria-label={activeLabel}
        title={isCollapsed ? activeLabel : undefined}
        className={cn(
          "flex h-9 items-center rounded-md border border-sahara-border bg-sahara-surface text-xs font-medium text-sahara-text-secondary",
          isCollapsed ? "justify-center px-0" : "justify-center gap-2 px-3",
        )}
      >
        <Timer aria-hidden="true" className="size-4 shrink-0" />
        {!isCollapsed && <span>{activeLabel}</span>}
      </div>
    );
  }

  return (
    <section
      aria-label="当前专注状态"
      className={cn(
        "flex items-center rounded-md border border-sahara-border bg-sahara-surface",
        isCollapsed ? "justify-center px-1 py-2" : "gap-1 p-1.5 pl-2.5",
      )}
    >
      <Link
        to="/"
        title={taskName}
        aria-label={`回到计时页：${taskName}，剩余 ${formattedTime}`}
        className={cn(
          "min-w-0 rounded-md text-sahara-text outline-none transition-colors duration-150 hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus",
          isCollapsed
            ? "flex w-full justify-center px-0.5 py-1"
            : "flex flex-1 flex-col items-start px-1.5 py-1 text-left",
        )}
      >
        {!isCollapsed && (
          <span className="block w-full truncate text-[11px] font-medium leading-4 text-sahara-text-secondary">
            {taskName}
          </span>
        )}
        <span
          role="timer"
          aria-live="off"
          className={cn(
            "font-mono font-semibold tabular-nums tracking-tight",
            isCollapsed ? "text-[11px]" : "text-lg leading-6",
          )}
        >
          {formattedTime}
        </span>
      </Link>

      {!isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          intent="default"
          onClick={status === "running" ? pause : resume}
          aria-label={status === "running" ? `暂停${phaseLabel}` : `继续${phaseLabel}`}
          title={status === "running" ? `暂停${phaseLabel}` : `继续${phaseLabel}`}
          className="size-8 shrink-0 text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text"
        >
          {status === "running" ? (
            <Pause aria-hidden="true" className="size-4 fill-current" />
          ) : (
            <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
          )}
        </Button>
      )}
    </section>
  );
}
