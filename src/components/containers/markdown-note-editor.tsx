import MDEditor from "@uiw/react-md-editor/nohighlight";
import * as commands from "@uiw/react-md-editor/commands-cn";
import rehypeSanitize from "rehype-sanitize";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

interface MarkdownNoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

const MARKDOWN_COMMANDS = commands.getCommands();
const MARKDOWN_EXTRA_COMMANDS = commands.getExtraCommands();

export default function MarkdownNoteEditor({
  value,
  onChange,
  onBlur,
}: MarkdownNoteEditorProps) {
  return (
    <MDEditor
      value={value}
      onChange={(nextValue) => onChange(nextValue ?? "")}
      onBlur={onBlur}
      height="100%"
      preview="edit"
      visibleDragbar={false}
      commands={MARKDOWN_COMMANDS}
      extraCommands={MARKDOWN_EXTRA_COMMANDS}
      previewOptions={{
        rehypePlugins: [[rehypeSanitize]],
      }}
      textareaProps={{
        "aria-label": "记录内容",
        placeholder: "开始写 Markdown...",
      }}
    />
  );
}
