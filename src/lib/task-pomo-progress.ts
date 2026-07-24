export interface TaskPomoProgressVisual {
  completedPomos: number;
  estimatedPomos: number;
  currentPomo: number | null;
  isCurrentPomoOverEstimate: boolean;
  overrunPomos: number;
}

function asNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Keeps completed work separate from the active session. The timer ring owns
 * the current-session progress; this model only describes the task budget.
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
  };
}
