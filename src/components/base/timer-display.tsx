import { useEffect, useId, useRef, useState, useMemo, type CSSProperties } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { formatSeconds } from "@/lib/time";
import {
  sanitizeTimeInput,
  parseTimeInput,
  formatEditableValueFromSeconds,
  formatEditingDisplay,
} from "@/lib/timer-utils";
import type { TimerPhase } from "@/features/timer/timer-types";
import type { TaskPomoProgressVisual } from "@/lib/task-pomo-progress";

interface TimerDisplayProps {
  secondsRemaining: number;
  totalSeconds: number;
  phase: TimerPhase;
  editable?: boolean;
  onDurationChange?: (seconds: number) => void;
  style?: "solid" | "zigzag";
  taskPomoProgress?: TaskPomoProgressVisual | null;
}

const SIZE_DESKTOP = 400;
const RADIUS_DESKTOP = 180;
const CENTER_DESKTOP = SIZE_DESKTOP / 2;

const SIZE_MOBILE = 260;
const RADIUS_MOBILE = 116;
const CENTER_MOBILE = SIZE_MOBILE / 2;

function generateWavyCirclePath(
  cx: number,
  cy: number,
  r: number,
  amplitude: number,
  frequency: number,
  phase: number,
) {
  let d = "";
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const wave = Math.sin(angle * frequency + phase) * amplitude;
    const currentRadius = r + wave;
    const x = cx + currentRadius * Math.cos(angle);
    const y = cy + currentRadius * Math.sin(angle);
    if (i === 0) {
      d += `M ${x} ${y} `;
    } else {
      d += `L ${x} ${y} `;
    }
  }
  return d;
}

function WavyRing({
  cx,
  cy,
  r,
  progress,
  style,
  strokeWidth,
  className,
  dotClassName = "fill-sahara-primary",
  stroke,
  showDot,
  isRunning,
}: {
  cx: number;
  cy: number;
  r: number;
  progress: number;
  style: string;
  strokeWidth: string;
  className: string;
  dotClassName?: string;
  stroke?: string;
  showDot?: boolean;
  isRunning?: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const amplitude = style === "zigzag" ? 8 : 0;
  const frequency = 12;

  useAnimationFrame((time) => {
    if (
      !pathRef.current ||
      !isRunning ||
      style !== "zigzag" ||
      prefersReducedMotion
    ) {
      return;
    }

    const phase = -(time / 400);
    pathRef.current.setAttribute(
      "d",
      generateWavyCirclePath(cx, cy, r, amplitude, frequency, phase),
    );

    if (dotRef.current && showDot && progress > 0 && progress < 100) {
      const angle = (progress / 100) * 2 * Math.PI;
      const wave = Math.sin(angle * frequency + phase) * amplitude;
      const currentRadius = r + wave;
      dotRef.current.setAttribute(
        "cx",
        String(cx + currentRadius * Math.cos(angle)),
      );
      dotRef.current.setAttribute(
        "cy",
        String(cy + currentRadius * Math.sin(angle)),
      );
    }
  });

  const staticD = useMemo(
    () => generateWavyCirclePath(cx, cy, r, amplitude, frequency, 0),
    [cx, cy, r, amplitude, frequency],
  );
  const dotAngle = (progress / 100) * 2 * Math.PI;
  const dotWave = Math.sin(dotAngle * frequency) * amplitude;
  const dotRadius = r + dotWave;

  return (
    <>
      <path
        ref={pathRef}
        d={staticD}
        fill="none"
        className={className}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={100 - progress}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 300ms ease" }}
      />
      {showDot && isRunning && progress > 0 && progress < 100 && (
        <circle
          ref={dotRef}
          cx={cx + dotRadius * Math.cos(dotAngle)}
          cy={cy + dotRadius * Math.sin(dotAngle)}
          r="5"
          className={dotClassName}
          style={{ transition: "opacity 1000ms ease" }}
        />
      )}
    </>
  );
}

function TaskPomoGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="8%" y1="92%" x2="92%" y2="8%">
        <stop offset="0%" className="timer-task-progress-gradient-start" />
        <stop offset="100%" className="timer-task-progress-gradient-end" />
      </linearGradient>
    </defs>
  );
}

export function TimerDisplay({
  secondsRemaining,
  totalSeconds,
  phase,
  editable = false,
  onDurationChange,
  style = "solid",
  taskPomoProgress = null,
}: TimerDisplayProps) {
  const gradientId = useId().replaceAll(":", "");
  const isRunning = secondsRemaining > 0 && secondsRemaining < totalSeconds;
  const isComplete = secondsRemaining <= 0;
  const progress =
    totalSeconds > 0
      ? Math.min(100, ((totalSeconds - secondsRemaining) / totalSeconds) * 100)
      : 100;
  const visibleTaskPomoProgress =
    phase === "work" ? taskPomoProgress : null;
  const progressRingClassName = visibleTaskPomoProgress
    ? cn(
        "timer-task-progress-ring",
        visibleTaskPomoProgress.isOverrun && "timer-task-overrun-ring",
      )
    : isComplete
      ? "stroke-sahara-ring-complete"
      : "stroke-sahara-primary";
  const progressDotClassName = visibleTaskPomoProgress
    ? "timer-task-progress-dot"
    : "fill-sahara-primary";
  const taskPomoStyle = visibleTaskPomoProgress
    ? ({
        "--timer-task-progress-start-color": visibleTaskPomoProgress.color,
        "--timer-task-progress-start-color-dark": visibleTaskPomoProgress.darkColor,
        "--timer-task-progress-end-color": visibleTaskPomoProgress.gradientEndColor,
        "--timer-task-progress-end-color-dark": visibleTaskPomoProgress.gradientEndDarkColor,
      } as CSSProperties)
    : undefined;
      
  const [rawInput, setRawInput] = useState(() =>
    formatEditableValueFromSeconds(secondsRemaining),
  );
  const [isEditing, setIsEditing] = useState(false);
  const originalSecondsRef = useRef(secondsRemaining);
  const cancelledRef = useRef(false);
  const displayedInputValue = isEditing
    ? rawInput
    : formatEditingDisplay(rawInput || "0");

  useEffect(() => {
    if (!editable || !isEditing) {
      setRawInput(formatEditableValueFromSeconds(secondsRemaining));
    }
  }, [editable, isEditing, secondsRemaining]);

  const commitDuration = (nextRawInput: string) => {
    if (!editable || !onDurationChange) return;

    const nextSeconds = parseTimeInput(nextRawInput);
    if (nextSeconds <= 0) {
      setRawInput(formatEditableValueFromSeconds(secondsRemaining));
      return;
    }

    onDurationChange(nextSeconds);
    setRawInput(formatEditableValueFromSeconds(nextSeconds));
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={taskPomoStyle}
    >
      {/* Desktop SVG */}
      <svg
        width={SIZE_DESKTOP}
        height={SIZE_DESKTOP}
        className="-rotate-90 hidden md:block"
        aria-hidden="true"
      >
        {visibleTaskPomoProgress && <TaskPomoGradient id={`${gradientId}-desktop`} />}
        {/* Full faded track — static */}
        <WavyRing
          cx={CENTER_DESKTOP}
          cy={CENTER_DESKTOP}
          r={RADIUS_DESKTOP}
          progress={100}
          style={style}
          strokeWidth="1"
          className="stroke-sahara-ring-track"
          showDot={false}
        />
        {/* White progress track — static, shows behind the animated ring */}
        <WavyRing
          cx={CENTER_DESKTOP}
          cy={CENTER_DESKTOP}
          r={RADIUS_DESKTOP}
          progress={progress}
          style={style}
          strokeWidth={style === "zigzag" ? "6" : "4"}
          className="stroke-sahara-ring-track-active"
          showDot={false}
        />
        {/* Animated progress ring */}
        <WavyRing
          cx={CENTER_DESKTOP}
          cy={CENTER_DESKTOP}
          r={RADIUS_DESKTOP}
          progress={progress}
          style={style}
          strokeWidth={style === "zigzag" ? "6" : "4"}
          className={progressRingClassName}
          dotClassName={progressDotClassName}
          stroke={
            visibleTaskPomoProgress ? `url(#${gradientId}-desktop)` : undefined
          }
          showDot={true}
          isRunning={isRunning}
        />
      </svg>

      {/* Mobile SVG */}
      <svg
        width={SIZE_MOBILE}
        height={SIZE_MOBILE}
        className="-rotate-90 md:hidden"
        aria-hidden="true"
      >
        {visibleTaskPomoProgress && <TaskPomoGradient id={`${gradientId}-mobile`} />}
        {/* Full faded track — static */}
        <WavyRing
          cx={CENTER_MOBILE}
          cy={CENTER_MOBILE}
          r={RADIUS_MOBILE}
          progress={100}
          style={style}
          strokeWidth="1"
          className="stroke-sahara-ring-track"
          showDot={false}
        />
        {/* White progress track — static, shows behind the animated ring */}
        <WavyRing
          cx={CENTER_MOBILE}
          cy={CENTER_MOBILE}
          r={RADIUS_MOBILE}
          progress={progress}
          style={style}
          strokeWidth={style === "zigzag" ? "5" : "3"}
          className="stroke-sahara-ring-track-active"
          showDot={false}
        />
        {/* Animated progress ring */}
        <WavyRing
          cx={CENTER_MOBILE}
          cy={CENTER_MOBILE}
          r={RADIUS_MOBILE}
          progress={progress}
          style={style}
          strokeWidth={style === "zigzag" ? "5" : "3"}
          className={progressRingClassName}
          dotClassName={progressDotClassName}
          stroke={
            visibleTaskPomoProgress ? `url(#${gradientId}-mobile)` : undefined
          }
          showDot={true}
          isRunning={isRunning}
        />
      </svg>

      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {editable && !isComplete ? (
          <label className="group flex items-center justify-center">
            <span className="sr-only">设置计时时长</span>
            <input
              type="text"
              name="timer-duration"
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9:]{0,2}(:[0-9]{0,2})?"
              aria-label="设置计时时长"
              value={displayedInputValue}
              onChange={(event) => {
                const nextRawInput = sanitizeTimeInput(event.target.value);
                setRawInput(nextRawInput);

                const nextSeconds = parseTimeInput(nextRawInput);
                if (nextSeconds > 0) {
                  onDurationChange?.(nextSeconds);
                }
              }}
              onFocus={(event) => {
                originalSecondsRef.current = secondsRemaining;
                cancelledRef.current = false;
                setIsEditing(true);
                requestAnimationFrame(() => {
                  const length = event.target.value.length;
                  event.target.setSelectionRange(length, length);
                });
              }}
              onBlur={() => {
                setIsEditing(false);
                if (!cancelledRef.current) {
                  commitDuration(rawInput);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }

                if (event.key === "Escape") {
                  cancelledRef.current = true;
                  onDurationChange?.(originalSecondsRef.current);
                  setRawInput(
                    formatEditableValueFromSeconds(originalSecondsRef.current),
                  );
                  setIsEditing(false);
                  event.currentTarget.blur();
                }
              }}
              className={cn(
                "w-[5.5ch] rounded-lg border border-transparent bg-transparent px-3 text-center font-mono font-medium leading-none tracking-[-0.06em] text-sahara-text outline-none transition-[background-color,border-color] duration-150 [font-variant-numeric:tabular-nums] md:px-4",
                "text-[76px] md:text-[120px]",
                "hover:border-sahara-border hover:bg-sahara-card",
                "focus:border-sahara-text focus:bg-sahara-card",
              )}
            />
          </label>
        ) : (
          <Text
            variant="timer"
            className={cn(
              isComplete ? "text-green-600" : "text-sahara-text",
              "font-mono text-[76px] font-medium tracking-[-0.06em] md:text-[120px]",
            )}
          >
            {formatSeconds(secondsRemaining)}
          </Text>
        )}
        <p className="mt-1 text-xs font-medium text-sahara-text-secondary md:mt-2">
          {phase === "work"
              ? "专注剩余"
              : phase === "short_break"
                ? "短休息"
                : "长休息"}
        </p>
        {visibleTaskPomoProgress && (
          <p
            className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-medium tabular-nums text-sahara-text-secondary"
            aria-live="polite"
            aria-label={`任务预算：${visibleTaskPomoProgress.label} 个番茄${visibleTaskPomoProgress.isOverrun ? `，已超 ${visibleTaskPomoProgress.overrunPomos} 个番茄` : ""}`}
          >
            <span className="text-sahara-text-muted">任务预算</span>
            <span className="timer-task-progress-value font-semibold">
              {visibleTaskPomoProgress.completedPomos} / {visibleTaskPomoProgress.estimatedPomos}
            </span>
            <span>个番茄</span>
            {visibleTaskPomoProgress.isOverrun && (
              <span className="timer-task-overrun-text">· 已超 {visibleTaskPomoProgress.overrunPomos} 个</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
