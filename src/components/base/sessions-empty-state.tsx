import { Sparkles } from "lucide-react";

export function SessionsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 bg-sahara-bg/30 rounded-2xl border border-dashed border-sahara-border/20">
      <Sparkles className="size-10 text-sahara-text-muted/40 mb-4" />
      <p className="font-serif text-lg text-sahara-text-secondary mb-2">
        今天还没有记录
      </p>
      <p className="text-sm text-sahara-text-muted text-center max-w-xs">
        开始第一段专注后，这里会记录你的深度工作时间。
      </p>
    </div>
  );
}
