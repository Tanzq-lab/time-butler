export type TaskPomoRingTone =
  | "start"
  | "progress"
  | "caution"
  | "final-in-budget"
  | "overrun";

export type TaskProgressTone =
  | "not-started"
  | "complete"
  | TaskPomoRingTone;

export const TASK_PROGRESS_TONE_CLASS_NAMES: Record<TaskProgressTone, string> = {
  "not-started": "task-pomo-not-started",
  "complete": "task-pomo-complete",
  "start": "timer-task-pomo-start",
  "progress": "timer-task-pomo-progress",
  "caution": "timer-task-pomo-caution",
  "final-in-budget": "timer-task-pomo-final-in-budget",
  "overrun": "timer-task-pomo-overrun",
};

export interface TaskPomoProgressVisual {
  completedPomos: number;
  estimatedPomos: number;
  currentPomo: number | null;
  isCurrentPomoOverEstimate: boolean;
  overrunPomos: number;
  ringTone: TaskPomoRingTone | null;
}

const BUDGET_RING_TONES: Exclude<TaskPomoRingTone, "overrun">[] = [
  "start",
  "progress",
  "caution",
  "final-in-budget",
];

function asNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function getRingTone(
  currentPomo: number | null,
  estimatedPomos: number,
): TaskPomoRingTone | null {
  if (currentPomo === null) return null;
  if (currentPomo > estimatedPomos) return "overrun";
  if (estimatedPomos === 1) return "start";

  const budgetPosition = (currentPomo - 1) / (estimatedPomos - 1);
  const toneIndex = Math.round(
    budgetPosition * (BUDGET_RING_TONES.length - 1),
  );
  return BUDGET_RING_TONES[toneIndex];
}

/**
 * Colors task-tree focus labels from completed pomodoros. A finished task
 * always uses the success color, while additional pomodoros stay red.
 */
export function getTaskPomoCompletionTone(
  completedPomos: number,
  estimatedPomos: number,
  completed: boolean,
): TaskProgressTone {
  if (completed) return "complete";

  const safeCompletedPomos = asNonNegativeInteger(completedPomos);
  const safeEstimatedPomos = asNonNegativeInteger(estimatedPomos);
  if (safeCompletedPomos === 0 || safeEstimatedPomos === 0) {
    return "not-started";
  }
  if (safeCompletedPomos > safeEstimatedPomos) return "overrun";
  if (
    safeCompletedPomos === safeEstimatedPomos
    || safeEstimatedPomos === 1
  ) {
    return "final-in-budget";
  }

  const budgetPosition =
    (safeCompletedPomos - 1) / (safeEstimatedPomos - 1);
  const toneIndex = Math.round(
    budgetPosition * (BUDGET_RING_TONES.length - 1),
  );
  return BUDGET_RING_TONES[toneIndex];
}

/**
 * Every parent task uses the same stage colour for its child-completion bar,
 * regardless of whether the children are todos or focus tasks. The bar never
 * reaches red because a child count cannot exceed its total.
 */
export function getTaskChildProgressTone(
  completedChildren: number,
  totalChildren: number,
): Exclude<TaskProgressTone, "overrun"> {
  const safeCompletedChildren = asNonNegativeInteger(completedChildren);
  const safeTotalChildren = asNonNegativeInteger(totalChildren);
  if (safeTotalChildren === 0 || safeCompletedChildren === 0) {
    return "not-started";
  }
  if (safeCompletedChildren >= safeTotalChildren) return "complete";
  if (safeTotalChildren === 2) return "final-in-budget";

  const budgetPosition =
    (safeCompletedChildren - 1) / (safeTotalChildren - 2);
  const toneIndex = Math.round(
    budgetPosition * (BUDGET_RING_TONES.length - 1),
  );
  return BUDGET_RING_TONES[toneIndex];
}

/**
 * Keeps completed work separate from the active session. The timer ring owns
 * the current-session progress and receives one solid color for the whole
 * pomodoro. Every supported estimate spans its own budget from energetic green
 * to a warm final-in-budget orange; only pomodoros beyond the estimate use red.
 */
export function getTaskPomoProgressVisual(
  completedPomos: number,
  estimatedPomos: number,
  hasActiveSession = false,
): TaskPomoProgressVisual | null {
  const completed = asNonNegativeInteger(completedPomos);
  const estimated = asNonNegativeInteger(estimatedPomos);

  if (estimated === 0) return null;

  const currentPomo = hasActiveSession ? completed + 1 : null;

  return {
    completedPomos: completed,
    estimatedPomos: estimated,
    currentPomo,
    isCurrentPomoOverEstimate:
      currentPomo !== null && currentPomo > estimated,
    overrunPomos: Math.max(0, completed - estimated),
    ringTone: getRingTone(currentPomo, estimated),
  };
}
