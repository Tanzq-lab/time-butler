import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { isTauri } from "@/lib/tauri";

export function SettingsPrivacySection() {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearAllData = async () => {
    if (!isTauri()) return;
    setClearing(true);
    try {
      const db = await getDb();
      await Promise.all([
        db.execute("DELETE FROM sessions"),
        db.execute("DELETE FROM tasks"),
        db.execute("DELETE FROM categories"),
        db.execute("DELETE FROM settings"),
        db.execute("DELETE FROM _schema_meta"),
      ]);
      setCleared(true);
    } catch {}
    setClearing(false);
  };

  return (
    <section>
      <h3 className="font-serif text-xl md:text-2xl text-sahara-text mb-6 md:mb-8">
        隐私与数据
      </h3>
      <div className="bg-sahara-bg/50 border border-sahara-border/15 rounded-xl md:rounded-2xl p-4 md:p-6 space-y-4">
        <p className="text-sm text-sahara-text-secondary leading-relaxed">
          你的所有数据都会通过 SQLite 保存在本设备本地，不会发送到任何外部服务器。
        </p>
        <div className="pt-4 border-t border-sahara-border/20">
          {cleared ? (
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              所有数据已清除。重启应用后即可重新开始。
            </p>
          ) : (
            <Button
              variant="outline"
              intent="red"
              size="sm"
              shape="rounded-xl"
              disabled={clearing}
              onClick={handleClearAllData}
              className="gap-2 text-[11px]"
            >
              {clearing ? "清除中…" : "清除所有数据"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
