import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { Task } from "@/features/tasks/task-types";

interface TaskNoteModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSubmit: (content: string) => Promise<boolean> | boolean;
}

export function TaskNoteModal({
  open,
  task,
  onClose,
  onSubmit,
}: TaskNoteModalProps) {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!open) return;
    setContent("");
    setSaveError("");
  }, [open, task]);

  if (!open || !task) return null;

  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSaving) return;

    setIsSaving(true);
    setSaveError("");
    try {
      const saved = await onSubmit(trimmedContent);
      if (saved) {
        setContent("");
        onClose();
      } else {
        setSaveError("暂时没能保存，请重试。");
      }
    } catch {
      setSaveError("暂时没能保存，请重试。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      backdropClassName="bg-sahara-text/25"
      showCloseButton
      ariaLabel="记录任务"
    >
      <div className="space-y-5 px-6 pb-6 pt-7 md:px-8 md:pt-8">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sahara-primary text-sahara-bg">
            <NotebookPen className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-sahara-text-secondary">
              任务随手记录
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold leading-snug text-sahara-text">
              {task.name}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-sahara-text-secondary">
              内容会附加到已有备注，并保留记录时间。
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="task-note-entry"
            className="mb-1.5 block text-[11px] font-medium text-sahara-text-secondary"
          >
            记录内容
          </label>
          <MarkdownEditor
            id="task-note-entry"
            value={content}
            onChange={setContent}
            ariaLabel="任务记录"
            placeholder="记录卡点、结论或下一步…"
            minRows={4}
            variant="compact"
            modes={["edit", "preview"]}
          />
        </div>

        {task.notes && (
          <details className="rounded-md border border-sahara-border bg-sahara-card px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-medium text-sahara-text-secondary marker:text-sahara-text-muted">
              查看已有记录
            </summary>
            <div className="mt-3 max-h-40 overflow-y-auto border-t border-sahara-border pt-3">
              <MarkdownRenderer
                content={task.notes}
                variant="compact"
                className="text-xs"
              />
            </div>
          </details>
        )}

        {saveError && (
          <p role="alert" className="text-xs text-red-600">
            {saveError}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            intent="default"
            fullWidth
            onClick={onClose}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="solid"
            intent="green"
            fullWidth
            disabled={!content.trim() || isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? "正在附加…" : "附加记录"}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
