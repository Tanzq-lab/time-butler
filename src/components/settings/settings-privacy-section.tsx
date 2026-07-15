import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { isTauri } from "@/lib/tauri";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SettingsPrivacySection() {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      setShowConfirm(false);
    } catch {}
    setClearing(false);
  };

  return (
    <section>
      <ConfirmDialog
        open={showConfirm}
        title="清除所有数据？"
        description="所有任务、专注记录、分类和设置都会从本设备永久删除，且无法恢复。"
        confirmLabel="永久清除"
        destructive
        busy={clearing}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleClearAllData}
      />
      <h3 className="mb-6 text-xl font-semibold text-sahara-text md:text-2xl">
        隐私与数据
      </h3>
      <div className="space-y-4 border-y border-sahara-border py-5">
        <p className="text-sm text-sahara-text-secondary leading-relaxed">
          你的所有数据都会通过 SQLite 保存在本设备本地，不会发送到任何外部服务器。
        </p>
        <div className="pt-4 border-t border-sahara-border/20">
          {cleared ? (
            <p className="text-xs font-semibold text-green-600">
              所有数据已清除。重启应用后即可重新开始。
            </p>
          ) : (
            <Button
              variant="outline"
              intent="red"
              size="sm"
              disabled={clearing}
              onClick={() => setShowConfirm(true)}
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
