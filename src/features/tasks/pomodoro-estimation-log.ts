import { invoke, isTauri } from "@/lib/tauri";
import type { ParsedTaskDraft } from "@/features/tasks/task-intake";

export interface PomodoroEstimationCreatedLog {
  event: "created";
  createdAt: string;
  taskName: string;
  project?: string;
  category?: string;
  estimatedPomos: number;
  confidence: ParsedTaskDraft["confidence"];
  reason: string;
  needsBreakdown: boolean;
}

export interface PomodoroEstimationCompletionLog {
  event: "completion";
  completedAt: string;
  taskName: string;
  estimatedPomos: number;
  actualPomos: number;
  delta: number;
  lesson: string;
}

export type PomodoroEstimationLogEntry =
  | PomodoroEstimationCreatedLog
  | PomodoroEstimationCompletionLog;

function nowIso(): string {
  return new Date().toISOString();
}

export function buildCreatedLogEntry(
  draft: ParsedTaskDraft,
  overrides?: {
    project?: string;
    category?: string;
    needsBreakdown?: boolean;
  },
): PomodoroEstimationCreatedLog {
  return {
    event: "created",
    createdAt: nowIso(),
    taskName: draft.name,
    project: overrides?.project || draft.project,
    category: overrides?.category || draft.categoryName,
    estimatedPomos: draft.estimatedPomos,
    confidence: draft.confidence,
    reason:
      draft.estimationReason ||
      draft.notes ||
      "根据番茄预估备忘录的基础规则进行预估。",
    needsBreakdown: overrides?.needsBreakdown ?? draft.needsBreakdown ?? false,
  };
}

export function buildCompletionLogEntry(
  task: {
    name: string;
    estimated_pomos: number;
    completed_pomos: number;
  },
  review?: string,
): PomodoroEstimationCompletionLog | null {
  const delta = task.completed_pomos - task.estimated_pomos;
  if (delta === 0) return null;

  const trimmedReview = review?.trim();
  const generatedLesson =
    delta > 0
      ? `实际比预估多 ${delta} 个番茄，后续类似任务应提高预估或提前拆分。`
      : `实际比预估少 ${Math.abs(delta)} 个番茄，后续类似任务可以降低预估或缩小任务粒度。`;

  return {
    event: "completion",
    completedAt: nowIso(),
    taskName: task.name,
    estimatedPomos: task.estimated_pomos,
    actualPomos: task.completed_pomos,
    delta,
    lesson: trimmedReview || generatedLesson,
  };
}

export async function appendPomodoroEstimationLog(
  entry: PomodoroEstimationLogEntry,
): Promise<void> {
  if (!isTauri()) return;

  try {
    await invoke("append_pomodoro_estimation_log", { event: entry });
  } catch (err) {
    console.warn("[PomodoroEstimationLog] Failed to append log:", err);
  }
}

export async function readPomodoroEstimationLog(): Promise<string> {
  if (!isTauri()) return "";

  try {
    return await invoke<string>("read_pomodoro_estimation_log");
  } catch (err) {
    console.warn("[PomodoroEstimationLog] Failed to read log:", err);
    return "";
  }
}
