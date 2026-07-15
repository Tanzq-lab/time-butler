import { Sparkles } from "lucide-react";

export function SessionsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-sahara-border bg-sahara-card/30 px-6 py-12">
      <Sparkles className="size-10 text-sahara-text-muted/40 mb-4" />
      <p className="mb-2 text-lg font-semibold text-sahara-text-secondary">
        今天还没有记录
      </p>
      <p className="text-sm text-sahara-text-muted text-center max-w-xs">
        开始第一段专注后，这里会记录你的深度工作时间。
      </p>
    </div>
  );
}
