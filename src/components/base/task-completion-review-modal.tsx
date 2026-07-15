import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import type { Task } from "@/features/tasks/task-types";

interface TaskCompletionReviewModalProps {
  open: boolean;
  task: Task | null;
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

export function TaskCompletionReviewModal({
  open,
  task,
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
      <div className="px-6 pt-7 pb-6 md:px-8 md:pt-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sahara-primary text-sahara-bg">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-sahara-text-secondary">
              完成任务复盘
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-snug text-sahara-text">
              {task.name}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[10px] border border-sahara-border bg-sahara-card p-3">
            <p className="text-[10px] font-medium text-sahara-text-secondary">
              预计
            </p>
            <p className="text-xl font-bold text-sahara-text tabular-nums mt-1">
              {task.estimated_pomos}
              <span className="text-xs text-sahara-text-muted ml-1">个</span>
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
              min={0}
              max={100}
              value={actualPomos}
              onChange={(e) =>
                setActualPomos(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="mt-1 w-full rounded-md bg-transparent text-xl font-bold text-sahara-text tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus"
            />
          </div>
        </div>

        <div
          className={
            requiresReview
              ? "rounded-[10px] border border-amber-200/70 bg-amber-50 px-4 py-3 text-amber-950"
              : "rounded-[10px] border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-emerald-950"
          }
        >
          <div className="flex items-start gap-2">
            {requiresReview && (
              <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-bold">{buildDeltaLabel(delta)}</p>
              {requiresReview && (
                <p className="text-xs leading-relaxed mt-1 text-amber-800">
                  实际和预估不一致，需要写下原因，方便后续制定任务时间。
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="completion-review"
            className="mb-1.5 block text-[11px] font-medium text-sahara-text-secondary"
          >
            复盘原因{requiresReview ? "（必填）" : "（可选）"}
          </label>
          <MarkdownEditor
            id="completion-review"
            value={review}
            onChange={setReview}
            ariaLabel="复盘原因"
            placeholder="例如：需求比预期简单、资料更散、调试时间比预期长…"
            minRows={4}
            variant="compact"
            modes={["edit", "preview"]}
          />
        </div>

        <div className="flex gap-3">
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
