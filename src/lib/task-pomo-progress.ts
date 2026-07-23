export interface TaskPomoProgressVisual {
  completedPomos: number;
  estimatedPomos: number;
  label: string;
  tone: "neutral" | "warning" | "danger";
  isOverrun: boolean;
  overrunPomos: number;
}

function asNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Keeps the countdown sweep visually quiet while exposing task-budget state.
 * Colour changes happen only at pomodoro boundaries: neutral while there is
 * room, warning for the final estimated pomodoro, and danger beyond budget.
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
    completed >= estimated
      ? "danger"
      : completed === estimated - 1
        ? "warning"
        : "neutral";

  return {
    completedPomos: completed,
    estimatedPomos: estimated,
    label: `${completed}/${estimated}`,
    tone,
    isOverrun,
    overrunPomos: Math.max(0, completed - estimated),
  };
}
