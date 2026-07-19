import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useUIStore } from "@/features/ui/use-ui-store";

export function TaskOverrunReviewModal() {
  const pending = useTimerStore((state) => state.pendingOverrunStart);
  const confirmOverrunStart = useTimerStore(
    (state) => state.confirmOverrunStart,
  );
  const cancelOverrunStart = useTimerStore(
    (state) => state.cancelOverrunStart,
  );
  const setFullscreenFocus = useUIStore((state) => state.setFullscreenFocus);
  const [goal, setGoal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!pending) return;
    setGoal("");
    setIsSubmitting(false);
    setSubmitError(null);
    submittingRef.current = false;
  }, [pending?.taskId, pending?.completedPomos]);

  if (!pending) return null;

  const trimmedGoal = goal.trim();
  const nextPomo = pending.completedPomos + 1;

  const handleSubmit = async () => {
    if (!trimmedGoal || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const shouldEnterFullscreen = pending.enterFullscreen;
      const started = await confirmOverrunStart(trimmedGoal);
      if (started && shouldEnterFullscreen) {
        setFullscreenFocus(true);
      } else if (!started) {
        setSubmitError("下一步保存失败，计时尚未开始，请再试一次。");
      }
    } catch {
      setSubmitError("计时启动失败，请检查后再试一次。");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      open
      onClose={() => {
        if (!submittingRef.current) cancelOverrunStart();
      }}
      maxWidth="max-w-xl"
      backdropClassName="bg-sahara-text/30 backdrop-blur-[2px]"
      ariaLabel="超额番茄路线复核"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
        className="px-6 pb-6 pt-7 md:px-8 md:pb-8 md:pt-8"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-sahara-text-secondary">
              预估已经用完
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-snug text-sahara-text">
              重新判断一下路线
            </h2>
          </div>
        </div>

        <div className="mt-5 rounded-[10px] border border-sahara-border bg-sahara-card px-4 py-3.5">
          <p className="truncate text-sm font-semibold text-sahara-text">
            {pending.taskName}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-sahara-text-secondary">
            预计 {pending.estimatedPomos} 个，已完成 {pending.completedPomos} 个。
            你即将开始第 {nextPomo} 个番茄。
          </p>
        </div>

        <div className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-sahara-text-secondary">
          <Route aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sahara-text" />
          <p>
            先停一下：当前路线仍然成立吗？有没有更小、更快的验证办法？
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="overrun-next-goal"
            className="mb-1.5 block text-[11px] font-medium text-sahara-text-secondary"
          >
            这一个番茄要验证或产出什么？
          </label>
          <textarea
            id="overrun-next-goal"
            name="overrun-next-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="例如：先验证报错是否来自缓存，不继续重构其他模块"
            rows={3}
            autoComplete="off"
            className="w-full resize-none rounded-md border border-sahara-border bg-sahara-surface px-3.5 py-3 text-sm leading-relaxed text-sahara-text outline-none transition-colors placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
          />
          {submitError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {submitError}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            intent="default"
            fullWidth
            onClick={cancelOverrunStart}
            disabled={isSubmitting}
          >
            先暂停，不继续
          </Button>
          <Button
            type="submit"
            variant="solid"
            intent="sahara"
            fullWidth
            disabled={!trimmedGoal || isSubmitting}
          >
            {isSubmitting ? "正在开始…" : "记录下一步并开始"}
          </Button>
        </div>
      </form>
    </ModalOverlay>
  );
}
