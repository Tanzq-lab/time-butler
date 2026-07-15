import { useReducer, useEffect } from "react";
import { usePresetsStore } from "@/features/timer/use-presets-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { Button } from "@/components/ui/button";
import { Settings2, Check, Trash2, Plus, Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TimerPreset } from "@/lib/db";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type PresetUI =
  | { type: "closed" }
  | { type: "browsing" }
  | { type: "editing"; preset: TimerPreset; name: string; work: number; break: number }
  | { type: "saving-new"; name: string };

type UIAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "START_EDIT"; preset: TimerPreset }
  | { type: "SET_EDIT_NAME"; name: string }
  | { type: "SET_EDIT_WORK"; work: number }
  | { type: "SET_EDIT_BREAK"; break_: number }
  | { type: "END_EDIT" }
  | { type: "START_SAVE" }
  | { type: "SET_NEW_NAME"; name: string }
  | { type: "END_SAVE" };

function uiReducer(state: PresetUI, action: UIAction): PresetUI {
  switch (action.type) {
    case "OPEN":
      return { type: "browsing" };
    case "CLOSE":
      return { type: "closed" };
    case "START_EDIT":
      return {
        type: "editing",
        preset: action.preset,
        name: action.preset.name,
        work: action.preset.work_duration,
        break: action.preset.short_break_duration,
      };
    case "SET_EDIT_NAME":
      return state.type === "editing" ? { ...state, name: action.name } : state;
    case "SET_EDIT_WORK":
      return state.type === "editing" ? { ...state, work: action.work } : state;
    case "SET_EDIT_BREAK":
      return state.type === "editing" ? { ...state, break: action.break_ } : state;
    case "END_EDIT":
      return { type: "browsing" };
    case "START_SAVE":
      return { type: "saving-new", name: "" };
    case "SET_NEW_NAME":
      return state.type === "saving-new" ? { ...state, name: action.name } : state;
    case "END_SAVE":
      return { type: "browsing" };
  }
}

export function PresetSelector() {
  const [ui, dispatch] = useReducer(uiReducer, { type: "closed" as const });

  const presets = usePresetsStore((s) => s.presets);
  const loadPresets = usePresetsStore((s) => s.loadPresets);
  const applyPreset = usePresetsStore((s) => s.applyPreset);
  const savePreset = usePresetsStore((s) => s.savePreset);
  const editPreset = usePresetsStore((s) => s.editPreset);
  const removePreset = usePresetsStore((s) => s.removePreset);
  const loaded = usePresetsStore((s) => s.loaded);
  const currentDurations = useTimerStore((s) => s.durations);
  const timerStatus = useTimerStore((s) => s.status);

  useEffect(() => {
    if (!loaded) loadPresets();
  }, [loaded, loadPresets]);

  const handleSave = async () => {
    if (ui.type !== "saving-new" || !ui.name.trim()) return;
    await savePreset(ui.name.trim());
    dispatch({ type: "END_SAVE" });
  };

  const handleSaveEdit = async () => {
    if (ui.type !== "editing" || !ui.name.trim()) return;
    useTimerStore
      .getState()
      .setDurations(ui.work, ui.break, ui.preset.long_break_duration);
    await editPreset(ui.preset.id, ui.name.trim());
    dispatch({ type: "END_EDIT" });
  };

  const isCurrentPreset = (preset: TimerPreset) => {
    return (
      preset.work_duration === currentDurations.work &&
      preset.short_break_duration === currentDurations.short &&
      preset.long_break_duration === currentDurations.long
    );
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-label="打开计时预设"
        onClick={() => dispatch({ type: "OPEN" })}
        className="cursor-pointer gap-1.5 border-sahara-border text-sahara-text-secondary hover:text-sahara-text"
      >
        <Settings2 aria-hidden="true" className="size-3.5" />
        <span className="text-[11px] font-medium">
          预设
        </span>
      </Button>

      <ModalOverlay
        open={ui.type !== "closed"}
        onClose={() => dispatch({ type: "CLOSE" })}
        maxWidth="max-w-md"
        showCloseButton
        ariaLabel="计时预设"
      >
        <div className="px-6 py-5 border-b border-sahara-border/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-sahara-text">
              计时预设
            </h3>
            <p className="text-[11px] text-sahara-text-secondary">
              快速切换配置
            </p>
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {presets.map((preset) => {
            const active = isCurrentPreset(preset);
            return (
              <div
                key={preset.id}
                className={cn(
                  "group flex items-center rounded-md border transition-colors duration-150",
                  active
                    ? "border-sahara-text-muted/45 bg-sahara-card"
                    : "bg-sahara-card/50 border-sahara-border/10 hover:border-sahara-primary/20",
                )}
              >
                <button
                  type="button"
                  disabled={timerStatus !== "idle"}
                  aria-pressed={active}
                  onClick={() => {
                    applyPreset(preset);
                    dispatch({ type: "CLOSE" });
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-md p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sahara-focus disabled:cursor-not-allowed"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md transition-colors",
                        active
                          ? "bg-sahara-primary text-sahara-bg"
                          : "bg-sahara-surface text-sahara-text-muted",
                      )}
                    >
                      <Clock aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-sm font-semibold",
                          active ? "text-sahara-text" : "text-sahara-text",
                        )}
                      >
                        {preset.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-sahara-text-muted">
                        <span>{preset.work_duration / 60} 分钟专注</span>
                        <span aria-hidden="true" className="size-1 rounded-full bg-sahara-border" />
                        <span>{preset.short_break_duration / 60} 分钟休息</span>
                      </span>
                    </span>
                  </span>

                  {active ? (
                    <span className="ml-2 rounded-full bg-sahara-primary/10 p-1.5 text-sahara-primary">
                      <Check aria-hidden="true" className="size-4" />
                    </span>
                  ) : null}
                </button>

                {!active && (
                  <div className="flex items-center gap-1 pr-2">
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: "START_EDIT", preset });
                        }}
                        aria-label={`编辑预设：${preset.name}`}
                        className="cursor-pointer rounded-md p-2 text-sahara-text-muted opacity-100 transition-colors hover:bg-sahara-card hover:text-sahara-text md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePreset(preset.id);
                        }}
                        aria-label={`删除预设：${preset.name}`}
                        className="cursor-pointer rounded-md p-2 text-sahara-text-muted opacity-100 transition-colors hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-5 bg-sahara-card/40 border-t border-sahara-border/10 space-y-4">
          {ui.type === "editing" ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-sahara-text-secondary">
                  编辑预设
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "END_EDIT" })}
                  aria-label="取消编辑预设"
                  className="text-sahara-text-muted cursor-pointer hover:text-sahara-text transition-colors"
                >
                  <Plus className="size-4 rotate-45" />
                </button>
              </div>

              <input
                type="text"
                name="edit-preset-name"
                autoComplete="off"
                aria-label="预设名称"
                value={ui.name}
                onChange={(e) => dispatch({ type: "SET_EDIT_NAME", name: e.target.value })}
                placeholder="预设名称"
                className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm outline-none transition-colors focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              />

              <div className="grid grid-cols-2 gap-3">
                <DurationControl
                  label="专注"
                  value={ui.work}
                  onChange={(v) => dispatch({ type: "SET_EDIT_WORK", work: v })}
                  step={300}
                />
                <DurationControl
                  label="休息"
                  value={ui.break}
                  onChange={(v) => dispatch({ type: "SET_EDIT_BREAK", break_: v })}
                  step={60}
                />
              </div>

              <Button
                variant="solid"
                intent="sahara"
                fullWidth
                onClick={handleSaveEdit}
                disabled={!ui.name.trim()}
                className="py-3"
              >
                保存修改
              </Button>
            </div>
          ) : ui.type === "saving-new" ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-sahara-text-secondary">
                  新预设详情
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "END_SAVE" })}
                  aria-label="取消新建预设"
                  className="text-sahara-text-muted hover:text-sahara-text transition-colors"
                >
                  <Plus className="size-4 rotate-45" />
                </button>
              </div>

              <input
                type="text"
                name="new-preset-name"
                autoComplete="off"
                aria-label="预设名称"
                value={ui.name}
                onChange={(e) => dispatch({ type: "SET_NEW_NAME", name: e.target.value })}
                placeholder="名称（例如：深度工作）"
                className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm outline-none transition-colors focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              />

              <div className="grid grid-cols-2 gap-3">
                <DurationControl
                  label="专注"
                  value={currentDurations.work}
                  onChange={(v) =>
                    useTimerStore
                      .getState()
                      .setDurations(v, currentDurations.short, currentDurations.long)
                  }
                  step={300}
                />
                <DurationControl
                  label="休息"
                  value={currentDurations.short}
                  onChange={(v) =>
                    useTimerStore
                      .getState()
                      .setDurations(currentDurations.work, v, currentDurations.long)
                  }
                  step={60}
                />
              </div>

              <Button
                variant="solid"
                intent="sahara"
                fullWidth
                onClick={handleSave}
                disabled={!ui.name.trim()}
                className="cursor-pointer py-3"
              >
                确认并保存预设
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: "START_SAVE" })}
              className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-sahara-border py-4 text-xs font-medium text-sahara-text-muted transition-colors hover:border-sahara-text-muted hover:bg-sahara-surface hover:text-sahara-text"
            >
              <Plus aria-hidden="true" className="size-4" />
              新建预设
            </button>
          )}
        </div>

        {timerStatus !== "idle" && (
          <div className="border-t border-amber-100 bg-amber-50 px-6 py-2.5 text-center text-[10px] font-medium text-amber-700">
            计时进行中，暂时不能切换模式
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}

function DurationControl({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
}) {
  return (
    <div className="rounded-md border border-sahara-border bg-sahara-surface p-3">
      <p className="mb-1 text-[10px] font-medium text-sahara-text-secondary">
        {label}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-sahara-text">
          {value / 60} 分钟
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={`减少${label}时长`}
            onClick={() => onChange(Math.max(60, value - step))}
            className="size-5 flex items-center justify-center rounded bg-sahara-card cursor-pointer hover:bg-sahara-border/20 text-sahara-text-muted transition-colors"
          >
            -
          </button>
          <button
            type="button"
            aria-label={`增加${label}时长`}
            onClick={() => onChange(value + step)}
            className="size-5 flex items-center justify-center rounded bg-sahara-card cursor-pointer hover:bg-sahara-border/20 text-sahara-text-muted transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
