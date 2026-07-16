export interface TaskPomoProgressVisual {
  completedPomos: number;
  estimatedPomos: number;
  label: string;
  color: string;
  darkColor: string;
  isOverrun: boolean;
  overrunPomos: number;
}

function asNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Gives the timer a stable, glanceable colour for a task's pomodoro budget.
 * The countdown sweep still represents elapsed time; this colour represents
 * how much of the task estimate has been used.
 */
export function getTaskPomoProgressVisual(
  completedPomos: number,
  estimatedPomos: number,
): TaskPomoProgressVisual | null {
  const completed = asNonNegativeInteger(completedPomos);
  const estimated = asNonNegativeInteger(estimatedPomos);

  if (estimated === 0) return null;

  const ratio = completed / estimated;
  const isOverrun = ratio > 1;

  // Reuse the app's existing action colours: calm green, last-mile amber,
  // then the same red used by the abandon action.
  let color = "#2f7d4e";
  let darkColor = "#6cc88a";
  if (isOverrun) {
    color = "#b42318";
    darkColor = "#fb7a70";
  } else if (ratio >= 1) {
    color = "#b42318";
    darkColor = "#fb7a70";
  } else if (ratio >= 0.75) {
    color = "#946200";
    darkColor = "#f0bd52";
  }

  return {
    completedPomos: completed,
    estimatedPomos: estimated,
    label: `${completed}/${estimated}`,
    color,
    darkColor,
    isOverrun,
    overrunPomos: Math.max(0, completed - estimated),
  };
}
