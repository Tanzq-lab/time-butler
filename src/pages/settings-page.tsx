import { useState } from "react";
import { useSettingsStore } from "@/features/settings/use-settings-store";
import { useNotificationStore } from "@/features/notifications/use-notification-store";
import { Monitor, Zap, Bell, Keyboard, Shield } from "lucide-react";

import { MainLayout } from "@/components/template/main-layout";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import type { SidebarTab } from "@/components/settings/settings-sidebar";
import { SettingsMobileTabs } from "@/components/settings/settings-mobile-tabs";
import { SettingsGeneralSection } from "@/components/settings/settings-general-section";
import { SettingsFocusSection } from "@/components/settings/settings-focus-section";
import { SettingsNotifications } from "@/components/settings/settings-notifications-section";
import { SettingsHotkeysSection } from "@/components/settings/settings-hotkeys-section";
import { SettingsPrivacySection } from "@/components/settings/settings-privacy-section";
import { PageHeader } from "@/components/ui/page-header";

const TABS: SidebarTab[] = [
  { id: "general", label: "通用", icon: Monitor },
  { id: "focus", label: "专注节奏", icon: Zap },
  { id: "notifications", label: "通知", icon: Bell },
  { id: "hotkeys", label: "快捷键", icon: Keyboard },
  { id: "privacy", label: "隐私与数据", icon: Shield },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const notifStatus = useNotificationStore((s) => s.status);
  const notifChecking = useNotificationStore((s) => s.checking);
  const notifError = useNotificationStore((s) => s.error);
  const requestNotifPermission = useNotificationStore(
    (s) => s.requestPermission,
  );

  return (
    <MainLayout>
      <div className="mx-auto flex h-full max-w-6xl flex-col px-4 py-7 sm:px-6 md:px-8 md:py-10 lg:px-10">
        <PageHeader eyebrow="配置" title="应用设置" description="调整主题、专注节奏、通知和本地数据。" className="mb-8" />

        <SettingsMobileTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="flex min-h-0 flex-1 gap-7 lg:gap-10">
          <SettingsSidebar
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="flex-1 overflow-y-auto border-t border-sahara-border bg-sahara-surface py-6 md:py-8">
            <div className="max-w-3xl space-y-8 px-1 md:px-6">
              {activeTab === "general" && (
                <SettingsGeneralSection
                  currentTheme={settings.theme}
                  onThemeChange={(t) => updateSetting("theme", t)}
                  timerStyle={settings.timerStyle}
                  onTimerStyleChange={(s) => updateSetting("timerStyle", s)}
                  settings={{
                    autoStartBreaks: settings.autoStartBreaks,
                  }}
                  onToggle={(k: string, v: boolean) =>
                    updateSetting(k as any, v)
                  }
                />
              )}

              {activeTab === "focus" && <SettingsFocusSection />}

              {activeTab === "notifications" && (
                <SettingsNotifications
                  notifStatus={{
                    status: notifStatus,
                    checking: notifChecking,
                    error: notifError,
                  }}
                  requestPermission={requestNotifPermission}
                  soundEnabled={settings.soundEnabled}
                  onSoundToggle={(v: boolean) =>
                    updateSetting("soundEnabled", v)
                  }
                />
              )}

              {activeTab === "hotkeys" && <SettingsHotkeysSection />}

              {activeTab === "privacy" && <SettingsPrivacySection />}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
