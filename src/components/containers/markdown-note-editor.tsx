import { MarkdownEditor } from "@/components/ui/markdown-editor";

interface MarkdownNoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export default function MarkdownNoteEditor({
  value,
  onChange,
  onBlur,
}: MarkdownNoteEditorProps) {
  return (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      ariaLabel="记录内容"
      placeholder="开始记录..."
      variant="workspace"
      className="h-full"
    />
  );
}
