import { useEffect, useRef, useState, useMemo } from "react";
import { useAnimationFrame } from "framer-motion";
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

interface TimerDisplayProps {
  secondsRemaining: number;
  totalSeconds: number;
  phase: TimerPhase;
  editable?: boolean;
  onDurationChange?: (seconds: number) => void;
  style?: "solid" | "zigzag";
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
  showDot?: boolean;
  isRunning?: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  const amplitude = style === "zigzag" ? 8 : 0;
  const frequency = 12;

  useAnimationFrame((time) => {
    if (!pathRef.current) return;

    const phase = isRunning && style === "zigzag" ? -(time / 400) : 0;
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

  return (
    <>
      <path
        ref={pathRef}
        d={staticD}
        fill="none"
        className={className}
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
          cx={cx + r * Math.cos((progress / 100) * 2 * Math.PI)}
          cy={cy + r * Math.sin((progress / 100) * 2 * Math.PI)}
          r="5"
          className="fill-sahara-primary"
          style={{ transition: "opacity 1000ms ease" }}
        />
      )}
    </>
  );
}

export function TimerDisplay({
  secondsRemaining,
  totalSeconds,
  phase,
  editable = false,
  onDurationChange,
  style = "solid",
}: TimerDisplayProps) {
  const isRunning = secondsRemaining > 0 && secondsRemaining < totalSeconds;
  const isComplete = secondsRemaining <= 0;
  const progress =
    totalSeconds > 0
      ? Math.min(100, ((totalSeconds - secondsRemaining) / totalSeconds) * 100)
      : 100;
      
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
    <div className="relative inline-flex items-center justify-center">
      {/* Desktop SVG */}
      <svg
        width={SIZE_DESKTOP}
        height={SIZE_DESKTOP}
        className="-rotate-90 hidden md:block"
      >
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
          className={cn(
            isComplete
              ? "stroke-sahara-ring-complete"
              : "stroke-sahara-primary",
          )}
          showDot={true}
          isRunning={isRunning}
        />
      </svg>

      {/* Mobile SVG */}
      <svg
        width={SIZE_MOBILE}
        height={SIZE_MOBILE}
        className="-rotate-90 md:hidden"
      >
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
          className={cn(isComplete ? "stroke-sahara-ring-complete" : "stroke-sahara-primary")}
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
      </div>
    </div>
  );
}
