export type TaskItemType = "todo" | "focus";

export interface Task {
  id: number;
  name: string;
  item_type?: TaskItemType;
  parent_id?: number | null;
  legacy_todo_id?: number | null;
  project?: string;
  priority?: "low" | "medium" | "high";
  sort_order?: number;
  estimated_pomos: number;
  completed_pomos: number;
  category_id?: number | null;
  scheduled_for?: string | null;
  completed_at?: string | null;
  completion_review?: string | null;
  notes?: string | null;
  created_at: string;
  archived: number;
}

export function getTaskItemType(task: Task): TaskItemType {
  return task.item_type === "todo" ? "todo" : "focus";
}

export function isFocusTask(task: Task): boolean {
  return getTaskItemType(task) === "focus";
}

export function isTodoTask(task: Task): boolean {
  return getTaskItemType(task) === "todo";
}

export function hasTaskChildren(task: Task, tasks: Task[]): boolean {
  return tasks.some(
    (candidate) =>
      candidate.archived === 0 && (candidate.parent_id ?? null) === task.id,
  );
}

export function isFocusableTask(task: Task, tasks: Task[]): boolean {
  return isFocusTask(task) && !hasTaskChildren(task, tasks);
}

export function getFocusableTasks(tasks: Task[]): Task[] {
  const parentIds = new Set(
    tasks
      .map((task) => task.parent_id ?? null)
      .filter((parentId): parentId is number => parentId != null),
  );
  return tasks.filter((task) => isFocusTask(task) && !parentIds.has(task.id));
}
