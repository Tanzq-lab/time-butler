const SHORTCUTS = [
  { keys: "\u2318 + Enter", action: "开始 / 暂停计时" },
  { keys: "\u2318 + R", action: "重置计时" },
  { keys: "\u2318 + F", action: "完成本轮" },
  { keys: "Escape", action: "关闭弹窗" },
];

export function SettingsHotkeysSection() {
  return (
    <section>
      <h3 className="mb-6 text-xl font-semibold text-sahara-text md:text-2xl">
        键盘快捷键
      </h3>
      <div className="border-y border-sahara-border py-2">
        <div className="space-y-4">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between border-b border-sahara-border py-3 last:border-b-0">
              <span className="text-sm text-sahara-text-secondary">
                {action}
              </span>
              <kbd className="rounded-md border border-sahara-border bg-sahara-card px-2.5 py-1.5 font-mono text-xs font-medium text-sahara-text-muted">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
