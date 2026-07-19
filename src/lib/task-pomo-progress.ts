export interface TaskPomoProgressVisual {
  completedPomos: number;
  estimatedPomos: number;
  label: string;
  /** The colour at the beginning of this pomodoro's sweep. */
  color: string;
  darkColor: string;
  /** The colour reached at the end of this pomodoro's sweep. */
  gradientEndColor: string;
  gradientEndDarkColor: string;
  isOverrun: boolean;
  overrunPomos: number;
}

interface ColorStop {
  ratio: number;
  color: string;
}

const LIGHT_BUDGET_STOPS: ColorStop[] = [
  { ratio: 0, color: "#2f7d4e" },
  { ratio: 0.5, color: "#70843c" },
  { ratio: 1, color: "#946200" },
];

const DARK_BUDGET_STOPS: ColorStop[] = [
  { ratio: 0, color: "#6cc88a" },
  { ratio: 0.5, color: "#b2c56a" },
  { ratio: 1, color: "#f0bd52" },
];

const OVERRUN_LIGHT = "#b42318";
const OVERRUN_DARK = "#fb7a70";

function asNonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function interpolateChannel(start: number, end: number, progress: number): number {
  return Math.round(start + (end - start) * progress);
}

function interpolateHex(start: string, end: string, progress: number): string {
  const startChannels = [1, 3, 5].map((offset) =>
    Number.parseInt(start.slice(offset, offset + 2), 16),
  );
  const endChannels = [1, 3, 5].map((offset) =>
    Number.parseInt(end.slice(offset, offset + 2), 16),
  );
  const channels = startChannels.map((channel, index) =>
    interpolateChannel(channel, endChannels[index], progress)
      .toString(16)
      .padStart(2, "0"),
  );

  return `#${channels.join("")}`;
}

function getBudgetColor(ratio: number, stops: ColorStop[]): string {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const upperStop = stops.find((stop) => stop.ratio >= clampedRatio) ?? stops.at(-1)!;
  const upperIndex = stops.indexOf(upperStop);
  const lowerStop = stops[Math.max(0, upperIndex - 1)];

  if (lowerStop === upperStop) return lowerStop.color;

  const segmentProgress =
    (clampedRatio - lowerStop.ratio) / (upperStop.ratio - lowerStop.ratio);
  return interpolateHex(lowerStop.color, upperStop.color, segmentProgress);
}

/**
 * Gives the timer a continuous, glanceable colour range for a task's
 * pomodoro budget. The countdown sweep still represents elapsed time; the
 * gradient shows which slice of the estimate the active pomodoro occupies.
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
  const startsBeyondEstimate = completed >= estimated;
  const startRatio = completed / estimated;
  const endRatio = Math.min(1, (completed + 1) / estimated);
  const color = startsBeyondEstimate
    ? OVERRUN_LIGHT
    : getBudgetColor(startRatio, LIGHT_BUDGET_STOPS);
  const darkColor = startsBeyondEstimate
    ? OVERRUN_DARK
    : getBudgetColor(startRatio, DARK_BUDGET_STOPS);
  const gradientEndColor = startsBeyondEstimate
    ? OVERRUN_LIGHT
    : getBudgetColor(endRatio, LIGHT_BUDGET_STOPS);
  const gradientEndDarkColor = startsBeyondEstimate
    ? OVERRUN_DARK
    : getBudgetColor(endRatio, DARK_BUDGET_STOPS);

  return {
    completedPomos: completed,
    estimatedPomos: estimated,
    label: `${completed}/${estimated}`,
    color,
    darkColor,
    gradientEndColor,
    gradientEndDarkColor,
    isOverrun,
    overrunPomos: Math.max(0, completed - estimated),
  };
}
