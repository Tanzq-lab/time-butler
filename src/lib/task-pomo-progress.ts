export type TaskPomoRingTone =
  | "start"
  | "progress"
  | "caution"
  | "limit"
  | "overrun";

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
  "limit",
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
 * Keeps completed work separate from the active session. The timer ring owns
 * the current-session progress and receives one solid color for the whole
 * pomodoro. Budget positions 1–4 move from energetic green to warning coral;
 * every pomodoro beyond the estimate uses the same red.
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
