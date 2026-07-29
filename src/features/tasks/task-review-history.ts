import type {
  Task,
  TaskCompletionReview,
} from "@/features/tasks/task-types";
import type {
  PomodoroEstimationCompletionLog,
} from "@/features/tasks/pomodoro-estimation-log";

export type TaskReviewHistoryKind = "completion" | "overrun" | "estimate";

export interface TaskReviewHistoryEntry {
  id: string;
  kind: TaskReviewHistoryKind;
  estimated_pomos: number;
  actual_pomos: number;
  review: string | null;
  recorded_at: string;
  next_pomo?: number;
}

interface ParsedCompletionLog extends PomodoroEstimationCompletionLog {
  lineIndex: number;
}

const TASK_NOTE_ENTRY_PATTERN =
  /\*\*(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\*\*\n\n([\s\S]*?)(?=\n\n\*\*\d{4}-\d{2}-\d{2} \d{2}:\d{2}\*\*\n\n|$)/g;

function parseRecordedAt(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTaskCreatedAt(value: string): number {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCompletionLogs(
  rawLog: string | null | undefined,
): ParsedCompletionLog[] {
  const entries: ParsedCompletionLog[] = [];

  (rawLog ?? "").split(/\r?\n/).forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const candidate = JSON.parse(trimmed) as Partial<
        PomodoroEstimationCompletionLog
      >;
      if (
        candidate.event !== "completion"
        || typeof candidate.completedAt !== "string"
        || typeof candidate.taskName !== "string"
        || typeof candidate.estimatedPomos !== "number"
        || typeof candidate.actualPomos !== "number"
        || typeof candidate.delta !== "number"
        || typeof candidate.lesson !== "string"
      ) {
        return;
      }
      entries.push({
        ...candidate,
        event: "completion",
        completedAt: candidate.completedAt,
        taskName: candidate.taskName,
        estimatedPomos: candidate.estimatedPomos,
        actualPomos: candidate.actualPomos,
        delta: candidate.delta,
        lesson: candidate.lesson,
        lineIndex,
      });
    } catch {
      // A malformed historical line should not hide the remaining valid log.
    }
  });

  return entries;
}

function findLegacyLogOwner(
  entry: ParsedCompletionLog,
  tasks: Task[],
): Task | null {
  if (entry.taskId != null) {
    return tasks.find((task) => task.id === entry.taskId) ?? null;
  }

  const completedAt = parseRecordedAt(entry.completedAt);
  const candidates = tasks.filter(
    (task) =>
      task.name === entry.taskName
      && (
        completedAt === 0
        || parseTaskCreatedAt(task.created_at) <= completedAt
      ),
  );
  const matchingEstimate = candidates.filter(
    (task) => task.estimated_pomos === entry.estimatedPomos,
  );
  const possibleOwners =
    matchingEstimate.length > 0 ? matchingEstimate : candidates;

  return (
    [...possibleOwners].sort(
      (a, b) =>
        parseTaskCreatedAt(b.created_at) - parseTaskCreatedAt(a.created_at)
        || b.id - a.id,
    )[0] ?? null
  );
}

function buildCompletionHistory(
  completionReviews: TaskCompletionReview[],
): TaskReviewHistoryEntry[] {
  return completionReviews.map((entry) => ({
    id: `completion:${entry.id}`,
    kind: "completion",
    estimated_pomos: entry.estimated_pomos,
    actual_pomos: entry.actual_pomos,
    review: entry.review,
    recorded_at: entry.completed_at,
  }));
}

export function parseTaskOverrunHistory(
  task: Task,
): TaskReviewHistoryEntry[] {
  if (!task.notes?.trim()) return [];

  const history: TaskReviewHistoryEntry[] = [];
  let match: RegExpExecArray | null;
  let entryIndex = 0;
  TASK_NOTE_ENTRY_PATTERN.lastIndex = 0;

  while ((match = TASK_NOTE_ENTRY_PATTERN.exec(task.notes)) !== null) {
    const recordedAt = match[1];
    const content = match[2].trim();
    const reviewMatch = content.match(
      /^\*\*超额番茄路线复核\*\*\s*\n\n第\s*(\d+)\s*个番茄[：:]\s*([\s\S]+)$/,
    );
    if (!reviewMatch) continue;

    const nextPomo = Number(reviewMatch[1]);
    if (!Number.isInteger(nextPomo) || nextPomo < 1) continue;

    history.push({
      id: `overrun:${task.id}:${recordedAt}:${entryIndex}`,
      kind: "overrun",
      estimated_pomos: task.estimated_pomos,
      actual_pomos: Math.max(0, nextPomo - 1),
      next_pomo: nextPomo,
      review: reviewMatch[2].trim(),
      recorded_at: recordedAt,
    });
    entryIndex += 1;
  }

  return history;
}

function buildEstimateHistory(
  task: Task,
  tasks: Task[],
  rawEstimationLog: string | null | undefined,
): TaskReviewHistoryEntry[] {
  return parseCompletionLogs(rawEstimationLog)
    .filter((entry) => findLegacyLogOwner(entry, tasks)?.id === task.id)
    .map((entry) => ({
      id: `estimate:${entry.taskId ?? entry.taskName}:${entry.completedAt}:${entry.lineIndex}`,
      kind: "estimate" as const,
      estimated_pomos: entry.estimatedPomos,
      actual_pomos: entry.actualPomos,
      review: entry.lesson.trim() || null,
      recorded_at: entry.completedAt,
    }));
}

function mergeDuplicateEstimateLogs(
  completionHistory: TaskReviewHistoryEntry[],
  estimateHistory: TaskReviewHistoryEntry[],
): TaskReviewHistoryEntry[] {
  const merged = [...completionHistory];

  estimateHistory.forEach((estimate) => {
    const duplicateIndex = merged.findIndex(
      (completion) =>
        completion.kind === "completion"
        && completion.estimated_pomos === estimate.estimated_pomos
        && completion.actual_pomos === estimate.actual_pomos
        && Math.abs(
          parseRecordedAt(completion.recorded_at)
          - parseRecordedAt(estimate.recorded_at),
        ) <= 10_000,
    );

    if (duplicateIndex < 0) {
      merged.push(estimate);
      return;
    }

    if (!merged[duplicateIndex].review?.trim() && estimate.review?.trim()) {
      merged[duplicateIndex] = {
        ...merged[duplicateIndex],
        review: estimate.review,
      };
    }
  });

  return merged;
}

export function buildTaskReviewHistory({
  task,
  tasks,
  completionReviews,
  rawEstimationLog,
}: {
  task: Task;
  tasks: Task[];
  completionReviews: TaskCompletionReview[];
  rawEstimationLog: string | null | undefined;
}): TaskReviewHistoryEntry[] {
  const completionAndEstimate = mergeDuplicateEstimateLogs(
    buildCompletionHistory(completionReviews),
    buildEstimateHistory(task, tasks, rawEstimationLog),
  );

  return [...completionAndEstimate, ...parseTaskOverrunHistory(task)].sort(
    (a, b) =>
      parseRecordedAt(b.recorded_at) - parseRecordedAt(a.recorded_at)
      || b.id.localeCompare(a.id),
  );
}
