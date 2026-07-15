import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { getSessionNotes, type SessionNoteEntry } from "@/lib/db";
import { formatDuration } from "@/lib/session-utils";
import { formatTimeAmPm } from "@/lib/time";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

const MOOD_EMOJI: Record<string, string> = {
  distracted: "😔",
  neutral: "😊",
  focused: "🤩",
};

function formatSessionTime(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
}

function formatSessionDate(startedAt: string): string {
  const date = new Date(startedAt);
  return date.toLocaleDateString("zh-CN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface SessionNotesProps {
  startDate?: string;
  endDate?: string;
}

export function SessionNotes({ startDate, endDate }: SessionNotesProps) {
  const [notes, setNotes] = useState<SessionNoteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSessionNotes(startDate, endDate)
      .then((entries) => setNotes(entries.filter((entry) =>
        Number.isFinite(entry.id) && Boolean(entry.started_at && entry.notes),
      )))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="rounded-[10px] border border-sahara-border bg-sahara-surface p-3.5 md:p-5">
        <p className="text-[15px] text-sahara-text-muted">加载中…</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-sahara-border bg-sahara-surface p-3.5 md:p-5">
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <FileText className="size-8 text-sahara-text-muted/40" />
          <p className="text-center text-[15px] text-sahara-text-secondary">
            还没有专注笔记
          </p>
          <p className="text-[15px] text-sahara-text-secondary">
            完成专注后填写的笔记会显示在这里
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((entry) => (
            <div
              key={entry.id}
              className="group rounded-[10px] border border-sahara-border bg-sahara-surface p-3.5 transition-colors duration-150 hover:border-sahara-text-muted md:p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {entry.mood && (
                    <span className="text-2xl">{MOOD_EMOJI[entry.mood] ?? "❓"}</span>
                  )}
                  {entry.category_name ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-sahara-border/20 bg-sahara-surface">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: entry.category_color ?? "#94a3b8" }}
                      />
                      <span
                        className="text-sm font-bold"
                        style={{ color: entry.category_color ?? "#94a3b8" }}
                      >
                        {entry.category_name}
                      </span>
                    </div>
                  ) : null}
                  {entry.task_name && (
                    <span className="text-[15px] font-medium text-sahara-text-secondary">
                      → {entry.task_name}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-sahara-text-muted tabular-nums">
                  {formatDuration(entry.duration_sec)}
                </span>
              </div>

              <MarkdownRenderer
                content={entry.notes}
                variant="compact"
                className="mb-2 text-[15px] md:text-[16px]"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs md:text-base text-sahara-text-muted font-medium">
                  {formatSessionDate(entry.started_at)}
                </span>
                <span className="text-xs md:text-base text-sahara-text-muted font-medium tabular-nums">
                  {formatSessionTime(entry.started_at, entry.ended_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
