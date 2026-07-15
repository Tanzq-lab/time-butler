import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { cn } from "@/lib/cn";

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  backdropClassName?: string;
  showCloseButton?: boolean;
  ariaLabel?: string;
  placement?: "center" | "bottom";
}

export function ModalOverlay({
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
  backdropClassName = "bg-black/20",
  showCloseButton = false,
  ariaLabel = "对话框",
  placement = "center",
}: ModalOverlayProps) {
  useEscapeClose(open, onClose);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialog) return;

      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previousActive?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-100 flex justify-center overscroll-contain",
        placement === "bottom"
          ? "items-end p-0"
          : "items-center p-4",
      )}
    >
      <div
        className={cn("absolute inset-0", backdropClassName)}
        aria-hidden="true"
        onMouseDown={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "relative w-full overflow-hidden border border-sahara-border bg-sahara-surface shadow-2xl animate-in fade-in duration-150",
          placement === "bottom"
            ? "max-h-[85dvh] rounded-t-[10px] border-b-0 slide-in-from-bottom-3"
            : "rounded-[10px] zoom-in-95",
          maxWidth,
        )}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭对话框"
            className="absolute right-3 top-3 z-10 rounded-md p-2 text-sahara-text-muted transition-colors hover:bg-sahara-card hover:text-sahara-text"
          >
            <X className="size-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
