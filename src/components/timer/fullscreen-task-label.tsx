import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskStore } from "@/features/tasks/use-task-store";

export function FullscreenTaskLabel() {
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const selectedCategory = useTimerStore((s) => s.selectedCategory);
  const tasks = useTaskStore((s) => s.tasks);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  if (!activeTask && !selectedCategory) return null;

  return (
    <div className="flex items-center gap-2.5 text-sm md:text-base text-sahara-text-secondary">
      {activeTask && <span className="font-medium">{activeTask.name}</span>}
      {activeTask && selectedCategory && (
        <span className="text-sahara-border">--</span>
      )}
      {selectedCategory && (
        <span className="inline-flex items-center rounded-full bg-sahara-card px-2.5 py-0.5 text-[11px] font-semibold text-sahara-text md:text-sm">
          {selectedCategory.name}
        </span>
      )}
    </div>
  );
}
