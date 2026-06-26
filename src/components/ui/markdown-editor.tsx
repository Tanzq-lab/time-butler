import { useEffect, useId, useMemo, useState } from "react";
import { Eye, PanelRightOpen, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

type MarkdownEditorMode = "edit" | "preview" | "split";
type MarkdownEditorVariant = "default" | "compact" | "workspace";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  minRows?: number;
  defaultMode?: MarkdownEditorMode;
  modes?: MarkdownEditorMode[];
  previewEmptyLabel?: string;
  variant?: MarkdownEditorVariant;
}

const MODE_META: Record<
  MarkdownEditorMode,
  { title: string; icon: typeof Pencil }
> = {
  edit: { title: "编辑", icon: Pencil },
  preview: { title: "预览", icon: Eye },
  split: { title: "分栏预览", icon: PanelRightOpen },
};

function getDefaultMode(
  variant: MarkdownEditorVariant,
  modes: MarkdownEditorMode[],
  requested?: MarkdownEditorMode,
): MarkdownEditorMode {
  if (requested && modes.includes(requested)) return requested;
  if (variant === "workspace" && modes.includes("split")) return "split";
  return modes[0] ?? "edit";
}

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  id,
  ariaLabel,
  placeholder,
  className,
  minRows = 5,
  defaultMode,
  modes,
  previewEmptyLabel,
  variant = "default",
}: MarkdownEditorProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const availableModes = useMemo<MarkdownEditorMode[]>(
    () =>
      modes ??
      (variant === "compact"
        ? ["edit", "preview"]
        : ["edit", "preview", "split"]),
    [modes, variant],
  );
  const [mode, setMode] = useState<MarkdownEditorMode>(() =>
    getDefaultMode(variant, availableModes, defaultMode),
  );

  useEffect(() => {
    if (!availableModes.includes(mode)) {
      setMode(getDefaultMode(variant, availableModes, defaultMode));
    }
  }, [availableModes, defaultMode, mode, variant]);

  const showEditor = mode === "edit" || mode === "split";
  const showPreview = mode === "preview" || mode === "split";

  return (
    <div
      className={cn(
        "markdown-editor",
        variant === "compact" && "markdown-editor--compact",
        variant === "workspace" && "markdown-editor--workspace",
        className,
      )}
    >
      <div className="markdown-editor__toolbar">
        <div className="markdown-editor__mode-controls">
          {availableModes.map((item) => {
            const Icon = MODE_META[item].icon;
            return (
              <button
                key={item}
                type="button"
                title={MODE_META[item].title}
                aria-label={MODE_META[item].title}
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
                className={cn(
                  "markdown-editor__mode-button",
                  mode === item && "markdown-editor__mode-button--active",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "markdown-editor__body",
          mode === "split" && "markdown-editor__body--split",
        )}
      >
        {showEditor && (
          <textarea
            id={inputId}
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            rows={minRows}
            className="markdown-editor__textarea"
          />
        )}
        {showPreview && (
          <div className="markdown-editor__preview">
            <MarkdownRenderer
              content={value}
              emptyLabel={previewEmptyLabel ?? placeholder ?? "暂无内容"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
