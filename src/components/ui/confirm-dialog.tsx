import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <ModalOverlay open={open} onClose={onClose} maxWidth="max-w-sm" ariaLabel={title}>
      <div className="p-5 md:p-6">
        <h2 className="pr-8 text-lg font-semibold tracking-[-0.015em] text-sahara-text">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-sahara-text-secondary">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" intent="default" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "solid"}
            intent={destructive ? "red" : "sahara"}
            size="sm"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "处理中…" : confirmLabel}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
