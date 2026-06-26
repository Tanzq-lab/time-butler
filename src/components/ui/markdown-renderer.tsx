import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

type MarkdownRendererVariant = "default" | "compact";

interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
  emptyLabel?: string;
  variant?: MarkdownRendererVariant;
}

const markdownComponents: Components = {
  a: ({ className, node: _node, ...props }) => (
    <a
      {...props}
      className={cn(className)}
      target="_blank"
      rel="noreferrer"
    />
  ),
  input: ({ className, node: _node, ...props }) => (
    <input {...props} className={cn(className)} disabled />
  ),
};

export function MarkdownRenderer({
  content,
  className,
  emptyLabel = "暂无内容",
  variant = "default",
}: MarkdownRendererProps) {
  const markdown = content ?? "";

  if (!markdown.trim()) {
    return (
      <p className={cn("markdown-empty", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "markdown-renderer",
        variant === "compact" && "markdown-renderer--compact",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
