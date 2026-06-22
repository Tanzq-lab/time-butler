const SHORTCUTS = [
  { keys: "\u2318 + Enter", action: "开始 / 暂停计时" },
  { keys: "\u2318 + R", action: "重置计时" },
  { keys: "\u2318 + F", action: "完成本轮" },
  { keys: "Escape", action: "关闭弹窗" },
];

export function SettingsHotkeysSection() {
  return (
    <section>
      <h3 className="font-serif text-xl md:text-2xl text-sahara-text mb-6 md:mb-8">
        键盘快捷键
      </h3>
      <div className="bg-sahara-bg/50 border border-sahara-border/15 rounded-xl md:rounded-2xl p-4 md:p-6">
        <div className="space-y-4">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between py-2">
              <span className="text-sm text-sahara-text-secondary">
                {action}
              </span>
              <kbd className="px-2.5 py-1.5 bg-sahara-card border border-sahara-border/30 rounded-lg text-xs font-mono font-bold text-sahara-text-muted">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
