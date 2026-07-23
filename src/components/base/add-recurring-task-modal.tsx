import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type React from "react";
import { CalendarDays, Pencil, Plus, Repeat2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCategoriesStore } from "@/features/categories/use-categories-store";
import type {
  RecurringTaskFrequency,
  RecurringTaskRuleInput,
  UserRecurringTaskRule,
} from "@/features/tasks/recurring-task-rules";
import { getRecurringTaskSchedule } from "@/features/tasks/recurring-task-rules";

const POMODORO_OPTIONS = [1, 2, 3, 4] as const;
type PomodoroEstimate = (typeof POMODORO_OPTIONS)[number];

export type AddRecurringTaskData = RecurringTaskRuleInput;

interface AddRecurringTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    data: AddRecurringTaskData,
  ) => boolean | void | Promise<boolean | void>;
  projectOptions?: string[];
  rules?: UserRecurringTaskRule[];
  onToggleRule?: (
    ruleId: number,
    enabled: boolean,
  ) => boolean | void | Promise<boolean | void>;
  onUpdateRule?: (
    ruleId: number,
    data: AddRecurringTaskData,
  ) => boolean | void | Promise<boolean | void>;
}

interface FormState {
  name: string;
  estimatedPomos: PomodoroEstimate | null;
  project: string;
  categoryId: number | null;
  frequency: RecurringTaskFrequency;
  startDate: string;
  scheduledTime: string;
}

type FormAction =
  | { type: "RESET"; payload: FormState }
  | {
      type: "SET_FIELD";
      field: keyof FormState;
      value: FormState[keyof FormState];
    };

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
});
const FREQUENCY_OPTIONS: {
  value: RecurringTaskFrequency;
  label: string;
}[] = [
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月同日" },
  { value: "monthly_first_day_off", label: "每月首个休息日" },
  { value: "yearly_first_day_off", label: "每年首个休息日" },
];

function toDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function initialFormState(): FormState {
  return {
    name: "",
    estimatedPomos: null,
    project: "",
    categoryId: null,
    frequency: "daily",
    startDate: toDateInputValue(new Date()),
    scheduledTime: "09:00",
  };
}

function formStateFromRule(rule: UserRecurringTaskRule): FormState {
  return {
    name: rule.name,
    estimatedPomos: rule.estimated_pomos as PomodoroEstimate,
    project: rule.project ?? "",
    categoryId: rule.category_id,
    frequency: getRecurringTaskSchedule(rule),
    startDate: rule.start_date,
    scheduledTime: rule.scheduled_time,
  };
}

function parseDateInput(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRecurringRuleSummary(
  frequency: RecurringTaskFrequency,
  startDate: string,
  scheduledTime: string,
): string {
  const date = parseDateInput(startDate);
  if (!date) return "选择开始日期后预览循环规则";

  const cadence = frequency === "daily"
    ? "每天"
    : frequency === "weekly"
      ? `每周${WEEKDAY_LABELS[date.getDay()]}`
      : frequency === "monthly"
        ? `每月${date.getDate()}日`
        : frequency === "monthly_first_day_off"
          ? "每月首个休息日"
          : "每年首个休息日";

  return `从 ${SHORT_DATE_FORMATTER.format(date)}起，${cadence} ${scheduledTime || "--:--"} 生成任务`;
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "RESET":
      return action.payload;
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    default:
      return state;
  }
}

export function AddRecurringTaskModal({
  open,
  onClose,
  onSubmit,
  projectOptions = [],
  rules = [],
  onToggleRule,
  onUpdateRule,
}: AddRecurringTaskModalProps) {
  const categories = useCategoriesStore((state) => state.categories);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const [form, dispatch] = useReducer(formReducer, undefined, initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [togglingRuleId, setTogglingRuleId] = useState<number | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const uniqueProjects = useMemo(
    () => [...new Set(projectOptions.map((project) => project.trim()).filter(Boolean))],
    [projectOptions],
  );

  useEffect(() => {
    if (!open) return;
    dispatch({ type: "RESET", payload: initialFormState() });
    setSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    setTogglingRuleId(null);
    setEditingRuleId(null);
    void loadCategories();
  }, [loadCategories, open]);

  useEffect(() => {
    if (open && editingRuleId !== null) nameInputRef.current?.focus();
  }, [editingRuleId, open]);

  const canSubmit =
    Boolean(form.name.trim())
    && form.estimatedPomos !== null
    && Boolean(form.startDate)
    && Boolean(form.scheduledTime)
    && !submitting;
  const ruleSummary = formatRecurringRuleSummary(
    form.frequency,
    form.startDate,
    form.scheduledTime,
  );
  const startDay = parseDateInput(form.startDate)?.getDate() ?? 0;
  const isEditing = editingRuleId !== null;
  const usesRestDaySchedule =
    form.frequency === "monthly_first_day_off"
    || form.frequency === "yearly_first_day_off";

  const beginEditing = (rule: UserRecurringTaskRule) => {
    dispatch({ type: "RESET", payload: formStateFromRule(rule) });
    setEditingRuleId(rule.id);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const cancelEditing = () => {
    dispatch({ type: "RESET", payload: initialFormState() });
    setEditingRuleId(null);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || form.estimatedPomos === null) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const data: AddRecurringTaskData = {
        name: form.name.trim(),
        estimatedPomos: form.estimatedPomos,
        project: form.project.trim() || null,
        categoryId: form.categoryId,
        frequency: form.frequency,
        startDate: form.startDate,
        scheduledTime: form.scheduledTime,
      };
      const submitted = isEditing && onUpdateRule
        ? await onUpdateRule(editingRuleId, data)
        : await onSubmit(data);
      if (submitted !== false) {
        if (isEditing) {
          dispatch({ type: "RESET", payload: initialFormState() });
          setEditingRuleId(null);
          setSubmitSuccess("循环规则已更新。修改只影响之后新生成的任务。");
          return;
        }
        onClose();
        return;
      }
      setSubmitError(
        isEditing
          ? "未能保存循环规则，请重试。"
          : "未能创建循环任务，请重试。",
      );
    } catch (error) {
      console.error("[RecurringTaskModal] Failed to save rule:", error);
      setSubmitError(
        isEditing
          ? "未能保存循环规则，请重试。"
          : "未能创建循环任务，请重试。",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule: UserRecurringTaskRule) => {
    if (!onToggleRule || togglingRuleId !== null) return;
    setTogglingRuleId(rule.id);
    setSubmitError(null);
    try {
      const toggled = await onToggleRule(rule.id, rule.enabled !== 1);
      if (toggled === false) {
        setSubmitError("未能更新循环规则，请重试。");
      }
    } catch (error) {
      console.error("[RecurringTaskModal] Failed to update rule:", error);
      setSubmitError("未能更新循环规则，请重试。");
    } finally {
      setTogglingRuleId(null);
    }
  };

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      maxWidth="max-w-xl"
      ariaLabel={isEditing ? "编辑循环任务" : "添加循环任务"}
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 md:p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-sahara-border bg-sahara-card text-sahara-text">
            <Repeat2 aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-balance text-lg font-semibold text-sahara-text">
              {isEditing ? "编辑循环任务" : "添加循环任务"}
            </h3>
            <p className="mt-0.5 text-xs text-sahara-text-muted">
              {isEditing
                ? "修改只影响之后新生成的任务"
                : "设定一次，任务会按节奏自动出现"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭对话框"
            className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-md text-sahara-text-muted outline-none transition-colors duration-150 hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <details className="mb-5 rounded-md border border-sahara-border bg-sahara-card/60">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium text-sahara-text outline-none transition-colors duration-150 hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sahara-focus">
            <Repeat2 aria-hidden="true" className="size-4 text-sahara-text-muted" />
            已配置规则
            <span className="ml-auto tabular-nums text-sahara-text-muted">
              {rules.length}
            </span>
          </summary>
          <div className="border-t border-sahara-border px-3 py-2">
            <p className="mb-2 text-[11px] leading-4 text-sahara-text-muted">
              原有规则和新建规则都可编辑或停用；修改仅影响之后新生成的任务。
            </p>
            {rules.length === 0 ? (
              <p className="rounded-md bg-sahara-surface px-3 py-3 text-xs text-sahara-text-muted">
                还没有已配置规则，可在下方创建第一条。
              </p>
            ) : (
              <div className="space-y-1.5">
                {rules.map((rule) => {
                  const enabled = rule.enabled === 1;
                  return (
                    <div
                      key={rule.id}
                      className="flex min-w-0 items-center gap-3 rounded-md bg-sahara-surface px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-xs font-medium text-sahara-text" title={rule.name}>
                            {rule.name}
                          </p>
                          {!enabled && (
                            <span className="shrink-0 rounded-full bg-sahara-card px-1.5 py-0.5 text-[10px] text-sahara-text-muted">
                              已停用
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-sahara-text-muted">
                          {formatRecurringRuleSummary(
                            getRecurringTaskSchedule(rule),
                            rule.start_date,
                            rule.scheduled_time,
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {onUpdateRule && (
                          <Button
                            type="button"
                            variant="outline"
                            intent="default"
                            size="xs"
                            aria-label={`编辑循环规则：${rule.name}`}
                            disabled={submitting || togglingRuleId !== null}
                            onClick={() => beginEditing(rule)}
                            className="min-h-10 gap-1"
                          >
                            <Pencil aria-hidden="true" className="size-3" />
                            编辑
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          intent="default"
                          size="xs"
                          aria-label={`${enabled ? "停用" : "启用"}循环规则：${rule.name}`}
                          disabled={submitting || togglingRuleId !== null}
                          onClick={() => void handleToggleRule(rule)}
                          className="min-h-10 shrink-0"
                        >
                          {togglingRuleId === rule.id
                            ? "更新中…"
                            : enabled
                              ? "停用"
                              : "启用"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="recurring-task-name"
              className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
            >
              任务名称
            </label>
            <input
              id="recurring-task-name"
              name="recurring-task-name"
              type="text"
              ref={nameInputRef}
              autoComplete="off"
              value={form.name}
              onChange={(event) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "name",
                  value: event.target.value,
                })
              }
              placeholder="例如：整理本周复盘…"
              className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
            />
          </div>

          <div>
            <label
              id="recurring-task-pomos-label"
              className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
            >
              预计番茄数
            </label>
            <div
              role="group"
              aria-labelledby="recurring-task-pomos-label"
              className="grid grid-cols-4 gap-2"
            >
              {POMODORO_OPTIONS.map((pomos) => {
                const selected = form.estimatedPomos === pomos;
                return (
                  <button
                    key={pomos}
                    type="button"
                    aria-label={`循环任务预计 ${pomos} 个番茄`}
                    aria-pressed={selected}
                    onClick={() =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "estimatedPomos",
                        value: pomos,
                      })
                    }
                    className={`flex h-11 items-center justify-center rounded-md border text-sm font-semibold tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus ${
                      selected
                        ? "border-sahara-text bg-sahara-card text-sahara-text"
                        : "border-sahara-border bg-sahara-surface text-sahara-text-secondary hover:border-sahara-text-muted hover:bg-sahara-card"
                    }`}
                  >
                    {pomos}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="recurring-task-project"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                项目 <span className="font-normal text-sahara-text-muted">（可选）</span>
              </label>
              <input
                id="recurring-task-project"
                name="recurring-task-project"
                type="text"
                list="recurring-task-project-options"
                autoComplete="off"
                value={form.project}
                onChange={(event) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "project",
                    value: event.target.value,
                  })
                }
                placeholder="例如：个人复盘…"
                className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              />
              <datalist id="recurring-task-project-options">
                {uniqueProjects.map((project) => (
                  <option key={project} value={project} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="recurring-task-category"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                分类 <span className="font-normal text-sahara-text-muted">（可选）</span>
              </label>
              <select
                id="recurring-task-category"
                name="recurring-task-category"
                value={form.categoryId ?? ""}
                onChange={(event) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "categoryId",
                    value: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none transition-colors duration-150 focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              >
                <option value="">不设置分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              id="recurring-task-frequency-label"
              className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
            >
              循环频率
            </label>
            <div
              role="group"
              aria-labelledby="recurring-task-frequency-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {FREQUENCY_OPTIONS.map((option) => {
                const selected = form.frequency === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "frequency",
                        value: option.value,
                      })
                    }
                    className={`h-11 rounded-md border px-2 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus last:col-span-2 sm:last:col-span-1 ${
                      selected
                        ? "border-sahara-text bg-sahara-card text-sahara-text"
                        : "border-sahara-border bg-sahara-surface text-sahara-text-secondary hover:bg-sahara-card"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <label
                htmlFor="recurring-task-start-date"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                {usesRestDaySchedule ? "生效日期" : "开始日期"}
              </label>
              <input
                id="recurring-task-start-date"
                name="recurring-task-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "startDate",
                    value: event.target.value,
                  })
                }
                className="h-10 w-full min-w-0 rounded-md border border-sahara-border bg-sahara-surface px-2.5 text-sm tabular-nums text-sahara-text outline-none transition-colors duration-150 focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20 sm:px-3"
              />
            </div>
            <div>
              <label
                htmlFor="recurring-task-time"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                提醒时间
              </label>
              <input
                id="recurring-task-time"
                name="recurring-task-time"
                type="time"
                value={form.scheduledTime}
                onChange={(event) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "scheduledTime",
                    value: event.target.value,
                  })
                }
                className="h-10 w-full min-w-0 rounded-md border border-sahara-border bg-sahara-surface px-2.5 text-sm tabular-nums text-sahara-text outline-none transition-colors duration-150 focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20 sm:px-3"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-sahara-border bg-sahara-card px-3 py-3 text-sahara-text-secondary">
            <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-xs font-medium leading-5 text-sahara-text">
                {ruleSummary}
              </p>
              {form.frequency === "monthly" && startDay > 28 && (
                <p className="mt-0.5 text-[11px] leading-4 text-sahara-text-muted">
                  遇到没有该日期的月份时，会安排在当月最后一天。
                </p>
              )}
            </div>
          </div>

          {submitError && (
            <p role="status" aria-live="polite" className="text-xs font-medium text-[#b42318]">
              {submitError}
            </p>
          )}

          {submitSuccess && (
            <p role="status" aria-live="polite" className="text-xs font-medium text-sahara-text-secondary">
              {submitSuccess}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              intent="default"
              size="md"
              fullWidth
              onClick={isEditing ? cancelEditing : onClose}
              disabled={submitting}
            >
              {isEditing ? "取消编辑" : "取消"}
            </Button>
            <Button
              type="submit"
              variant="solid"
              intent={canSubmit ? "sahara" : "default"}
              fullWidth
              disabled={!canSubmit}
              className="gap-2"
            >
              {isEditing ? (
                <Save aria-hidden="true" className="size-4" />
              ) : (
                <Plus aria-hidden="true" className="size-4" />
              )}
              {submitting
                ? isEditing
                  ? "正在保存…"
                  : "正在创建…"
                : isEditing
                  ? "保存修改"
                  : "创建循环任务"}
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
