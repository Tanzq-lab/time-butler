import { CheckCircle2 } from "lucide-react";
import type { Session } from "@/lib/session-utils";
import { formatTime, formatDuration } from "@/lib/session-utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface SessionCardProps {
  session: Session;
}

const MOOD_EMOJI: Record<string, string> = {
  great: "\u{1F604}",
  good: "\u{1F642}",
  okay: "\u{1F610}",
  bad: "\u{1F615}",
  terrible: "\u{1F61E}",
};

function getPhaseLabel(phase: string): string {
  if (phase === "work") return "专注";
  if (phase === "short_break") return "短休息";
  if (phase === "long_break") return "长休息";
  return phase.replace("_", " ");
}

function getAccentColor(session: Session): string {
  if (session.category_color) return session.category_color;
  return session.phase === "work"
    ? "var(--color-sahara-primary)"
    : "var(--color-sahara-text-secondary)";
}

export function SessionCard({ session }: SessionCardProps) {
  const accentColor = getAccentColor(session);
  const tagLabel = session.intention || session.category_name;

  return (
    <div className="group relative flex items-stretch gap-0 overflow-hidden rounded-[10px] border border-sahara-border bg-sahara-surface transition-colors duration-150 hover:border-sahara-text-muted">
      <div
        className="w-1.5 shrink-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex-1 flex items-center justify-between px-4 md:px-5 py-3.5 md:py-4 min-w-0">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="flex items-center justify-center size-8 md:w-9 md:h-9 rounded-full bg-sahara-card/50 border border-sahara-border/10 shrink-0">
            <CheckCircle2
              aria-hidden="true"
              className="size-4 shrink-0 md:size-5"
              style={{ color: accentColor }}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm md:text-base font-bold text-sahara-text capitalize tracking-tight">
                {getPhaseLabel(session.phase)}
              </p>

              {tagLabel && (
                <span
                  className="shrink-0 rounded-md px-2.5 py-0.5 text-[10px] font-semibold md:text-[11px]"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                    color: accentColor,
                  }}
                >
                  {tagLabel}
                </span>
              )}

              {session.mood && MOOD_EMOJI[session.mood] && (
                <span
                  className="shrink-0 text-sm md:text-base ml-0.5"
                  title={session.mood}
                >
                  {MOOD_EMOJI[session.mood]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-xs md:text-sm text-sahara-text-secondary font-medium tabular-nums">
                {formatTime(session.started_at)} &mdash;{" "}
                {session.ended_at
                  ? formatTime(session.ended_at)
                  : "进行中"}
              </p>
              {session.task_name && (
                <>
                  <span className="size-1 rounded-full bg-sahara-border/60" />
                  <p className="text-xs md:text-sm text-sahara-text-secondary font-medium truncate max-w-32 md:max-w-48">
                    {session.task_name}
                  </p>
                </>
              )}
            </div>

            {session.notes && (
              <div className="mt-1.5 max-h-12 max-w-48 overflow-hidden border-l-2 border-sahara-border/30 pl-2 md:max-w-72">
                <MarkdownRenderer
                  content={session.notes}
                  variant="compact"
                  className="text-xs md:text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right ml-4">
          <p className="text-lg md:text-xl font-bold text-sahara-primary tabular-nums tracking-tight">
            {formatDuration(session.duration_sec)}
          </p>
        </div>
      </div>
    </div>
  );
}
