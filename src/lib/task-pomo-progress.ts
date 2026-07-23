export interface TaskPomoProgressVisual {
  completedPomos: number;
  estimatedPomos: number;
  label: string;
  tone: "active" | "warning" | "danger";
  isOverrun: boolean;
  overrunPomos: number;
}

function asNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Uses a calm active tone for every pomodoro inside the task budget. Warning
 * begins only after the estimate has been consumed; danger begins after the
 * completed count actually exceeds the estimate.
 */
export function getTaskPomoProgressVisual(
  completedPomos: number,
  estimatedPomos: number,
): TaskPomoProgressVisual | null {
  const completed = asNonNegativeInteger(completedPomos);
  const estimated = asNonNegativeInteger(estimatedPomos);

  if (estimated === 0) return null;

  const isOverrun = completed > estimated;
  const tone =
    completed > estimated
      ? "danger"
      : completed === estimated
        ? "warning"
        : "active";

  return {
    completedPomos: completed,
    estimatedPomos: estimated,
    label: `${completed}/${estimated}`,
    tone,
    isOverrun,
    overrunPomos: Math.max(0, completed - estimated),
  };
}
