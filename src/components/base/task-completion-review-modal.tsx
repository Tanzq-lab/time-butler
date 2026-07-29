import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type {
  Task,
  TaskCompletionReview,
} from "@/features/tasks/task-types";

interface TaskCompletionReviewModalProps {
  open: boolean;
  task: Task | null;
  history?: TaskCompletionReview[];
  historyLoading?: boolean;
  historyError?: boolean;
  onClose: () => void;
  onSubmit: (data: { actualPomos: number; review: string }) => void | Promise<void>;
}

function getDefaultActualPomos(task: Task | null): number {
  if (!task) return 0;
  return Math.max(0, task.completed_pomos);
}

function buildDeltaLabel(delta: number): string {
  if (delta === 0) return "实际和预估一致";
  if (delta > 0) return `比预估多 ${delta} 个番茄`;
  return `比预估少 ${Math.abs(delta)} 个番茄`;
}

function formatCompletionTime(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getHistoryDeltaClassName(delta: number): string {
  if (delta > 0) return "text-[var(--color-timer-pomo-overrun)]";
  if (delta < 0) return "text-[var(--color-timer-complete)]";
  return "text-sahara-text-secondary";
}

export function TaskCompletionReviewModal({
  open,
  task,
  history = [],
  historyLoading = false,
  historyError = false,
  onClose,
  onSubmit,
}: TaskCompletionReviewModalProps) {
  const [actualPomos, setActualPomos] = useState(0);
  const [review, setReview] = useState("");

  useEffect(() => {
    if (!open) return;
    setActualPomos(getDefaultActualPomos(task));
    setReview("");
  }, [open, task]);

  const delta = useMemo(() => {
    if (!task) return 0;
    return actualPomos - task.estimated_pomos;
  }, [actualPomos, task]);

  const requiresReview = delta !== 0;
  const canSubmit = !!task && (!requiresReview || review.trim().length > 0);

  if (!open || !task) return null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({ actualPomos, review: review.trim() });
    setReview("");
    onClose();
  };

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      backdropClassName="bg-sahara-text/25"
      ariaLabel="完成任务复盘"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="min-h-0 space-y-6 overflow-y-auto px-4 pt-6 pb-5 sm:px-6 md:px-8 md:pt-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sahara-primary text-sahara-bg">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-sahara-text-secondary">
                完成任务复盘
              </p>
              <h2 className="mt-1 break-words text-pretty text-xl font-semibold leading-snug text-sahara-text">
                {task.name}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[10px] border border-sahara-border bg-sahara-card p-3">
              <p className="text-[10px] font-medium text-sahara-text-secondary">
                预计
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-sahara-text">
                {task.estimated_pomos}
                <span className="ml-1 text-xs text-sahara-text-muted">个</span>
              </p>
            </div>

            <div className="rounded-[10px] border border-sahara-border bg-sahara-card p-3">
              <label
                htmlFor="actual-pomos"
                className="block text-[10px] font-medium text-sahara-text-secondary"
              >
                实际
              </label>
              <input
                id="actual-pomos"
                type="number"
                name="actual-pomos"
                autoComplete="off"
                min={0}
                max={100}
                value={actualPomos}
                onChange={(e) =>
                  setActualPomos(Math.max(0, parseInt(e.target.value, 10) || 0))
                }
                className="mt-1 w-full rounded-md bg-transparent text-xl font-bold tabular-nums text-sahara-text outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
              />
            </div>
          </div>

          <div
            className={
              requiresReview
                ? "rounded-[10px] border border-amber-200/70 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-100"
                : "rounded-[10px] border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-100"
            }
          >
            <div className="flex items-start gap-2">
              {requiresReview && (
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                />
              )}
              <div>
                <p className="text-sm font-bold">{buildDeltaLabel(delta)}</p>
                {requiresReview && (
                  <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                    实际和预估不一致，需要写下原因，方便后续制定任务时间。
                  </p>
                )}
              </div>
            </div>
          </div>

          <section aria-labelledby="completion-history-heading">
            <div className="mb-2 flex items-center gap-2">
              <History
                aria-hidden="true"
                className="size-4 text-sahara-text-secondary"
              />
              <h3
                id="completion-history-heading"
                className="text-[11px] font-semibold text-sahara-text"
              >
                历史复盘
              </h3>
              {!historyLoading && history.length > 0 && (
                <span className="font-mono text-[10px] tabular-nums text-sahara-text-muted">
                  {history.length} 条
                </span>
              )}
            </div>

            {historyLoading ? (
              <p
                role="status"
                className="rounded-[10px] border border-sahara-border bg-sahara-card/60 px-3 py-4 text-xs text-sahara-text-secondary"
              >
                正在读取历史复盘…
              </p>
            ) : historyError ? (
              <p
                role="alert"
                className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-4 text-xs leading-5 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
              >
                无法读取历史复盘。请关闭弹窗后重试。
              </p>
            ) : history.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-sahara-border px-3 py-4 text-xs leading-5 text-sahara-text-secondary">
                还没有历史复盘。本次完成后，预计、实际和原因会保留在这里。
              </p>
            ) : (
              <ol className="overflow-hidden rounded-[10px] border border-sahara-border bg-sahara-surface">
                {history.map((entry) => {
                  const historyDelta =
                    entry.actual_pomos - entry.estimated_pomos;
                  return (
                    <li
                      key={entry.id}
                      className="border-b border-sahara-border px-3 py-3 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <time
                          dateTime={entry.completed_at}
                          className="text-[10px] font-medium text-sahara-text-secondary"
                        >
                          {formatCompletionTime(entry.completed_at)}
                        </time>
                        <span
                          className={`text-[10px] font-semibold ${getHistoryDeltaClassName(historyDelta)}`}
                        >
                          {buildDeltaLabel(historyDelta)}
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-sahara-text-secondary">
                        预计 {entry.estimated_pomos}
                        <span aria-hidden="true"> · </span>
                        实际 {entry.actual_pomos}
                      </p>
                      <MarkdownRenderer
                        content={entry.review}
                        emptyLabel="未填写复盘原因"
                        variant="compact"
                        className="mt-2 text-xs leading-5 text-sahara-text"
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <div>
            <label
              htmlFor="completion-review"
              className="mb-1.5 block text-[11px] font-medium text-sahara-text-secondary"
            >
              本次复盘原因{requiresReview ? "（必填）" : "（可选）"}
            </label>
            <MarkdownEditor
              id="completion-review"
              value={review}
              onChange={setReview}
              ariaLabel="本次复盘原因"
              placeholder="例如：需求比预期简单、资料更散、调试时间比预期长…"
              minRows={4}
              variant="compact"
              modes={["edit", "preview"]}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-sahara-border bg-sahara-surface px-4 py-4 sm:px-6 md:px-8">
          <Button
            type="button"
            variant="outline"
            intent="default"
            fullWidth
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="solid"
            intent={canSubmit ? "green" : "default"}
            fullWidth
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            保存完成记录
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
