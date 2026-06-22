import {
  Play,
  Pause,
  SkipForward,
  Maximize2,
  Hash,
} from "lucide-react";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/session-utils";

export function TimerMiniPlayer() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    phase,
    status,
    secondsRemaining,
    totalSeconds,
    activeTaskId,
    selectedCategory,
    pause,
    resume,
    skip,
  } = useTimerStore();

  const tasks = useTaskStore((s) => s.tasks);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // Only show if a session is active and we are NOT on the timer page.
  // and we are NOT on the timer page
  const isTimerPage =
    location.pathname === "/" || location.pathname === "/timer";
  const isActive = status !== "idle";

  if (isTimerPage || !isActive) return null;

  const progress = Math.max(
    0,
    Math.min(100, ((totalSeconds - secondsRemaining) / totalSeconds) * 100),
  );

  const phaseLabel = phase === "work" ? "专注" : "休息";
  const accentColor = selectedCategory?.color || "var(--color-sahara-primary)";

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-sahara-surface/80 backdrop-blur-2xl border border-sahara-border/20 rounded-2xl p-3 md:p-4 shadow-2xl shadow-black/20 flex items-center gap-4 md:gap-6">
        {/* Progress & Exit */}
        <button
          onClick={() => navigate("/")}
          className="group relative size-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
        >
          <div
            className="absolute inset-0 bg-sahara-card opacity-40"
            style={{
              background: `conic-gradient(${accentColor} ${progress}%, transparent 0)`,
            }}
          />
          <div className="absolute inset-1 bg-sahara-surface rounded-[10px] flex items-center justify-center transition-transform group-hover:scale-95">
            <Maximize2 className="size-5 text-sahara-text-secondary group-hover:text-sahara-primary transition-colors" />
          </div>
        </button>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-sahara-primary/10 text-sahara-primary"
              style={{
                color: accentColor,
                backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              }}
            >
              {phaseLabel}
            </span>
            {selectedCategory && (
              <div className="flex items-center gap-1 min-w-0">
                <Hash className="size-3 text-sahara-text-muted" />
                <span className="text-[10px] font-bold text-sahara-text-muted truncate">
                  {selectedCategory.name}
                </span>
              </div>
            )}
          </div>
          <h4 className="text-sm md:text-base font-semibold text-sahara-text truncate leading-tight">
            {activeTask?.name || "独立专注"}
          </h4>
        </div>

        {/* Timer & Controls */}
        <div className="flex items-center gap-3 md:gap-5 shrink-0">
          <div className="text-right tabular-nums">
            <p
              className={cn(
                "text-lg md:text-xl font-black tracking-tight",
                "text-sahara-text",
              )}
            >
              {formatDuration(secondsRemaining)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {status === "running" ? (
              <button
                onClick={pause}
                className="size-10 md:w-11 md:h-11 rounded-full bg-sahara-surface border border-sahara-border/10 flex items-center justify-center text-sahara-text hover:bg-sahara-card transition-colors shadow-sm"
              >
                <Pause className="size-5" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={resume}
                className="size-10 md:w-11 md:h-11 rounded-full bg-sahara-primary flex items-center justify-center text-white hover:brightness-110 transition-all shadow-lg shadow-sahara-primary/20 scale-105"
              >
                <Play className="size-5 ml-0.5" fill="currentColor" />
              </button>
            )}

            <button
              onClick={skip}
              className="size-10 md:w-11 md:h-11 rounded-full bg-sahara-surface border border-sahara-border/10 flex items-center justify-center text-sahara-text-muted hover:text-sahara-text hover:bg-sahara-card transition-colors"
              title="跳过当前阶段"
            >
              <SkipForward
                className="size-4 md:w-5 md:h-5"
                fill="currentColor"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
