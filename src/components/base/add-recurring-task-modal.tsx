import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type React from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Focus,
  ListTree,
  ListTodo,
  Pencil,
  Plus,
  Repeat2,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCategoriesStore } from "@/features/categories/use-categories-store";
import type {
  RecurringTaskFrequency,
  RecurringTaskRuleInput,
  RecurringTaskTemplateSubtask,
  UserRecurringTaskRule,
} from "@/features/tasks/recurring-task-rules";
import {
  getRecurringTaskItemType,
  getRecurringTaskSchedule,
  getRecurringTaskSubtasks,
  isCustomRecurringTaskRule,
} from "@/features/tasks/recurring-task-rules";

const POMODORO_OPTIONS = [1, 2, 3, 4] as const;
type PomodoroEstimate = (typeof POMODORO_OPTIONS)[number];
type ChildView = "focus" | "subtasks" | "attributes" | "schedule" | "rules";
type ModalView = "main" | ChildView | "delete";

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
  onDeleteRule?: (
    ruleId: number,
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
  subtasks: RecurringTaskTemplateSubtask[];
}

type FormAction =
  | { type: "RESET"; payload: FormState }
  | {
      type: "SET_FIELD";
      field: keyof FormState;
      value: FormState[keyof FormState];
    };

interface DialogHeaderProps {
  title: string;
  description: string;
  onClose: () => void;
  onBack?: () => void;
  backButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  summary: string;
  ariaLabel: string;
  onClick: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

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

const CHILD_VIEW_LABELS: Record<ChildView, string> = {
  focus: "设置专注任务",
  subtasks: "设置模板子任务",
  attributes: "设置任务属性",
  schedule: "设置循环时间",
  rules: "管理循环规则",
};

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
    subtasks: [],
  };
}

function formStateFromRule(rule: UserRecurringTaskRule): FormState {
  return {
    name: rule.name,
    estimatedPomos: getRecurringTaskItemType(rule) === "focus"
      ? (rule.estimated_pomos as PomodoroEstimate)
      : null,
    project: rule.project ?? "",
    categoryId: rule.category_id,
    frequency: getRecurringTaskSchedule(rule),
    startDate: rule.start_date,
    scheduledTime: rule.scheduled_time,
    subtasks: getRecurringTaskSubtasks(rule),
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

function DialogHeader({
  title,
  description,
  onClose,
  onBack,
  backButtonRef,
}: DialogHeaderProps) {
  return (
    <header className="mb-6 flex items-start gap-3">
      {onBack ? (
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          aria-label="返回循环任务"
          className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-md border border-sahara-border bg-sahara-card text-sahara-text outline-none transition-colors duration-150 hover:bg-sahara-primary-light focus-visible:ring-2 focus-visible:ring-sahara-focus"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-sahara-border bg-sahara-card text-sahara-text">
          <Repeat2 aria-hidden="true" className="size-5" />
        </div>
      )}

      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="text-balance text-lg font-semibold text-sahara-text">
          {title}
        </h3>
        <p className="mt-0.5 text-pretty text-xs leading-4 text-sahara-text-muted">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="关闭对话框"
        className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-md text-sahara-text-muted outline-none transition-colors duration-150 hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </header>
  );
}

function SettingsRow({
  icon,
  title,
  summary,
  ariaLabel,
  onClick,
  buttonRef,
}: SettingsRowProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex min-h-14 w-full touch-manipulation items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-sahara-card focus-visible:bg-sahara-card focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sahara-focus sm:px-4"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sahara-card text-sahara-text-secondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-sahara-text">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-sahara-text-muted">
          {summary}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-sahara-text-muted"
      />
    </button>
  );
}

export function AddRecurringTaskModal({
  open,
  onClose,
  onSubmit,
  projectOptions = [],
  rules = [],
  onToggleRule,
  onUpdateRule,
  onDeleteRule,
}: AddRecurringTaskModalProps) {
  const categories = useCategoriesStore((state) => state.categories);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const [form, dispatch] = useReducer(formReducer, undefined, initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [togglingRuleId, setTogglingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [rulePendingDelete, setRulePendingDelete] =
    useState<UserRecurringTaskRule | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<ModalView>("main");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const rulesButtonRef = useRef<HTMLButtonElement>(null);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const subtasksButtonRef = useRef<HTMLButtonElement>(null);
  const attributesButtonRef = useRef<HTMLButtonElement>(null);
  const scheduleButtonRef = useRef<HTMLButtonElement>(null);
  const lastMainTriggerRef = useRef<ChildView | null>(null);
  const focusNameOnMainRef = useRef(false);
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
    setDeletingRuleId(null);
    setRulePendingDelete(null);
    setSubtaskDraft("");
    setEditingRuleId(null);
    setActiveView("main");
    lastMainTriggerRef.current = null;
    focusNameOnMainRef.current = false;
    void loadCategories();
  }, [loadCategories, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (activeView !== "main") {
        backButtonRef.current?.focus();
        return;
      }
      if (focusNameOnMainRef.current) {
        focusNameOnMainRef.current = false;
        nameInputRef.current?.focus();
        return;
      }
      const lastTrigger = lastMainTriggerRef.current;
      if (lastTrigger === "rules") rulesButtonRef.current?.focus();
      if (lastTrigger === "focus") focusButtonRef.current?.focus();
      if (lastTrigger === "subtasks") subtasksButtonRef.current?.focus();
      if (lastTrigger === "attributes") attributesButtonRef.current?.focus();
      if (lastTrigger === "schedule") scheduleButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, open]);

  const canSubmit =
    Boolean(form.name.trim())
    && Boolean(form.startDate)
    && Boolean(form.scheduledTime)
    && form.subtasks.every((subtask) => Boolean(subtask.name.trim()))
    && !submitting;
  const isEditing = editingRuleId !== null;
  const ruleSummary = formatRecurringRuleSummary(
    form.frequency,
    form.startDate,
    form.scheduledTime,
  );
  const startDay = parseDateInput(form.startDate)?.getDate() ?? 0;
  const usesRestDaySchedule =
    form.frequency === "monthly_first_day_off"
    || form.frequency === "yearly_first_day_off";
  const categoryName = categories.find(
    (category) => category.id === form.categoryId,
  )?.name;
  const attributeSummary = [
    form.project.trim() ? `项目：${form.project.trim()}` : "",
    categoryName ? `分类：${categoryName}` : "",
  ].filter(Boolean).join(" · ") || "未设置项目或分类";
  const focusSubtaskCount = form.subtasks.filter(
    (subtask) => subtask.itemType === "focus",
  ).length;
  const subtaskSummary = form.subtasks.length === 0
    ? "未添加子任务"
    : `${form.subtasks.length} 个子任务${
        focusSubtaskCount > 0 ? ` · ${focusSubtaskCount} 个专注` : ""
      }`;
  const mainDialogLabel = isEditing ? "编辑循环任务" : "添加循环任务";

  const openChildView = (view: ChildView) => {
    lastMainTriggerRef.current = view;
    setActiveView(view);
  };

  const returnToMain = () => {
    setActiveView("main");
  };

  const closeDialog = () => {
    setActiveView("main");
    setRulePendingDelete(null);
    onClose();
  };

  const handleLayerDismiss = () => {
    if (activeView === "main") {
      closeDialog();
      return;
    }
    if (activeView === "delete") {
      setRulePendingDelete(null);
      setActiveView("rules");
      return;
    }
    returnToMain();
  };

  const beginEditing = (rule: UserRecurringTaskRule) => {
    dispatch({ type: "RESET", payload: formStateFromRule(rule) });
    setEditingRuleId(rule.id);
    setSubmitError(null);
    setSubmitSuccess(null);
    focusNameOnMainRef.current = true;
    setActiveView("main");
  };

  const cancelEditing = () => {
    dispatch({ type: "RESET", payload: initialFormState() });
    setEditingRuleId(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    nameInputRef.current?.focus();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const data: AddRecurringTaskData = {
        name: form.name.trim(),
        itemType: form.estimatedPomos === null ? "todo" : "focus",
        estimatedPomos: form.estimatedPomos ?? 1,
        project: form.project.trim() || null,
        categoryId: form.categoryId,
        frequency: form.frequency,
        startDate: form.startDate,
        scheduledTime: form.scheduledTime,
        subtasks: form.subtasks.map((subtask) => ({
          ...subtask,
          name: subtask.name.trim(),
        })),
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
        closeDialog();
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

  const addTemplateSubtask = (event: React.FormEvent) => {
    event.preventDefault();
    const name = subtaskDraft.trim();
    if (!name) return;
    dispatch({
      type: "SET_FIELD",
      field: "subtasks",
      value: [
        ...form.subtasks,
        {
          name,
          itemType: "todo",
          estimatedPomos: 1,
        },
      ],
    });
    setSubtaskDraft("");
  };

  const updateTemplateSubtask = (
    index: number,
    patch: Partial<RecurringTaskTemplateSubtask>,
  ) => {
    dispatch({
      type: "SET_FIELD",
      field: "subtasks",
      value: form.subtasks.map((subtask, subtaskIndex) =>
        subtaskIndex === index ? { ...subtask, ...patch } : subtask),
    });
  };

  const removeTemplateSubtask = (index: number) => {
    dispatch({
      type: "SET_FIELD",
      field: "subtasks",
      value: form.subtasks.filter((_, subtaskIndex) => subtaskIndex !== index),
    });
  };

  const beginDeleting = (rule: UserRecurringTaskRule) => {
    if (!isCustomRecurringTaskRule(rule) || !onDeleteRule) return;
    setRulePendingDelete(rule);
    setSubmitError(null);
    setSubmitSuccess(null);
    setActiveView("delete");
  };

  const cancelDeleting = () => {
    setRulePendingDelete(null);
    setActiveView("rules");
  };

  const handleDeleteRule = async () => {
    if (!rulePendingDelete || !onDeleteRule || deletingRuleId !== null) return;

    const rule = rulePendingDelete;
    setDeletingRuleId(rule.id);
    setSubmitError(null);
    try {
      const deleted = await onDeleteRule(rule.id);
      if (deleted === false) {
        setSubmitError("未能删除循环规则，请重试。");
        return;
      }
      setRulePendingDelete(null);
      setSubmitSuccess(`“${rule.name}”的循环规则已删除。`);
      setActiveView("rules");
    } catch (error) {
      console.error("[RecurringTaskModal] Failed to delete rule:", error);
      setSubmitError("未能删除循环规则，请重试。");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const renderMainView = () => (
    <>
      <DialogHeader
        title={isEditing ? "编辑循环任务" : "创建循环任务"}
        description={
          isEditing
            ? "修改只影响之后新生成的任务"
            : "先定义任务模板，需要时再打开具体设置"
        }
        onClose={closeDialog}
      />

      <button
        ref={rulesButtonRef}
        type="button"
        onClick={() => openChildView("rules")}
        aria-label={`管理已配置规则，共 ${rules.length} 条`}
        className="mb-5 flex min-h-12 w-full touch-manipulation items-center gap-2 rounded-md border border-sahara-border bg-sahara-card/60 px-3 text-xs font-medium text-sahara-text outline-none transition-colors duration-150 hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus"
      >
        <Repeat2 aria-hidden="true" className="size-4 text-sahara-text-muted" />
        已配置规则
        <span className="ml-auto tabular-nums text-sahara-text-muted">
          {rules.length}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-sahara-text-muted"
        />
      </button>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section aria-labelledby="recurring-task-template-label">
          <div className="mb-2">
            <h4
              id="recurring-task-template-label"
              className="text-xs font-semibold text-sahara-text"
            >
              任务模板
            </h4>
            <p className="mt-0.5 text-[11px] leading-4 text-sahara-text-muted">
              生成后就是一条普通任务，可继续按原有方式修改。
            </p>
          </div>

          <div className="flex min-w-0 items-start gap-2.5 rounded-[10px] border border-sahara-border bg-sahara-surface px-3 py-3 sm:px-4">
            <span
              aria-hidden="true"
              className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-sahara-text-muted/55 bg-sahara-surface"
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="recurring-task-name" className="sr-only">
                任务名称
              </label>
              <div className="flex min-w-0 items-center">
                {form.estimatedPomos !== null && (
                  <span className="task-pomo-label task-pomo-not-started shrink-0 text-sm font-medium leading-8">
                    专注：
                  </span>
                )}
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
                  placeholder="添加任务…"
                  className="h-8 min-w-0 flex-1 bg-transparent px-0.5 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-sahara-focus"
                />
              </div>
              {form.estimatedPomos !== null && (
                <p className="task-pomo-label task-pomo-not-started mt-0.5 font-mono text-[11px] font-semibold tabular-nums">
                  0/{form.estimatedPomos}
                </p>
              )}
            </div>

            <button
              ref={focusButtonRef}
              type="button"
              onClick={() => openChildView("focus")}
              aria-label={
                form.estimatedPomos === null
                  ? "设为专注"
                  : `编辑专注设置，当前 ${form.estimatedPomos} 个番茄`
              }
              className="flex min-h-10 shrink-0 touch-manipulation items-center gap-1 rounded-md px-2 text-xs font-medium text-sahara-text-secondary outline-none transition-colors duration-150 hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
            >
              <Focus aria-hidden="true" className="size-3.5" />
              {form.estimatedPomos === null
                ? "设为专注"
                : `${form.estimatedPomos} 个番茄`}
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 text-sahara-text-muted"
              />
            </button>
          </div>
        </section>

        <section
          aria-label="循环任务设置摘要"
          className="overflow-hidden rounded-[10px] border border-sahara-border bg-sahara-surface"
        >
          <SettingsRow
            buttonRef={subtasksButtonRef}
            icon={<ListTree aria-hidden="true" className="size-4" />}
            title="子任务"
            summary={subtaskSummary}
            ariaLabel={`编辑模板子任务，${subtaskSummary}`}
            onClick={() => openChildView("subtasks")}
          />
          <div className="mx-3 border-t border-sahara-border sm:mx-4" />
          <SettingsRow
            buttonRef={attributesButtonRef}
            icon={
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            }
            title="任务属性"
            summary={attributeSummary}
            ariaLabel={`编辑任务属性，${attributeSummary}`}
            onClick={() => openChildView("attributes")}
          />
          <div className="mx-3 border-t border-sahara-border sm:mx-4" />
          <SettingsRow
            buttonRef={scheduleButtonRef}
            icon={<CalendarDays aria-hidden="true" className="size-4" />}
            title="循环设置"
            summary={ruleSummary}
            ariaLabel={`编辑循环设置，${ruleSummary}`}
            onClick={() => openChildView("schedule")}
          />
        </section>

        {submitError && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs font-medium text-[#b42318]"
          >
            {submitError}
          </p>
        )}

        {submitSuccess && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs font-medium text-sahara-text-secondary"
          >
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
            onClick={isEditing ? cancelEditing : closeDialog}
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
            className="gap-2 whitespace-nowrap px-2 text-xs sm:px-4 sm:text-sm"
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
    </>
  );

  const renderFocusView = () => (
    <>
      <DialogHeader
        title="专注设置"
        description="普通待办需要投入时，再增加番茄预算。"
        onBack={returnToMain}
        onClose={closeDialog}
        backButtonRef={backButtonRef}
      />

      <section aria-labelledby="recurring-task-pomos-label" className="space-y-5">
        <div className="flex min-w-0 items-start gap-3 rounded-[10px] border border-sahara-border bg-sahara-card/60 px-3 py-3">
          {form.estimatedPomos === null ? (
            <ListTodo
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-sahara-text-secondary"
            />
          ) : (
            <Focus
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-sahara-text-secondary"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sahara-text">
              {form.name.trim() || "未命名任务"}
            </p>
            <p className="mt-0.5 text-[11px] text-sahara-text-muted">
              {form.estimatedPomos === null
                ? "当前为普通待办"
                : `当前预计 ${form.estimatedPomos} 个番茄`}
            </p>
          </div>
        </div>

        <div>
          <h4
            id="recurring-task-pomos-label"
            className="mb-2 text-xs font-medium text-sahara-text-secondary"
          >
            预计番茄数
          </h4>
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
                  aria-label={`预计 ${pomos} 个番茄`}
                  aria-pressed={selected}
                  onClick={() =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "estimatedPomos",
                      value: pomos,
                    })
                  }
                  className={`flex h-12 touch-manipulation items-center justify-center rounded-md border text-base font-semibold tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus ${
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

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            intent="default"
            size="md"
            fullWidth
            onClick={() => {
              dispatch({
                type: "SET_FIELD",
                field: "estimatedPomos",
                value: null,
              });
              returnToMain();
            }}
          >
            {form.estimatedPomos === null ? "保留普通待办" : "改为普通待办"}
          </Button>
          <Button
            type="button"
            variant="solid"
            intent={form.estimatedPomos === null ? "default" : "sahara"}
            size="md"
            fullWidth
            disabled={form.estimatedPomos === null}
            onClick={returnToMain}
          >
            完成专注设置
          </Button>
        </div>
      </section>
    </>
  );

  const renderSubtasksView = () => (
    <>
      <DialogHeader
        title="子任务"
        description="每次生成主任务时，会一起复制这一层子任务。"
        onBack={returnToMain}
        onClose={closeDialog}
        backButtonRef={backButtonRef}
      />

      <section className="space-y-5" aria-label="编辑模板子任务">
        <form
          onSubmit={addTemplateSubtask}
          className="flex items-center gap-2 rounded-[10px] border border-sahara-border bg-sahara-surface p-2"
        >
          <label htmlFor="recurring-subtask-draft" className="sr-only">
            新增模板子任务
          </label>
          <input
            id="recurring-subtask-draft"
            name="recurring-subtask-draft"
            type="text"
            autoComplete="off"
            value={subtaskDraft}
            onChange={(event) => setSubtaskDraft(event.target.value)}
            placeholder="输入子任务名称…"
            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-sahara-focus"
          />
          <Button
            type="submit"
            variant="solid"
            intent={subtaskDraft.trim() ? "sahara" : "default"}
            size="sm"
            disabled={!subtaskDraft.trim()}
            className="shrink-0 touch-manipulation"
          >
            添加
          </Button>
        </form>

        {form.subtasks.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-sahara-border bg-sahara-card/45 px-4 py-8 text-center">
            <ListTree
              aria-hidden="true"
              className="mx-auto size-5 text-sahara-text-muted"
            />
            <p className="mt-2 text-xs font-medium text-sahara-text">
              还没有子任务
            </p>
            <p className="mt-1 text-[11px] leading-4 text-sahara-text-muted">
              新增后默认是待办，也可以设为专注任务。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {form.subtasks.map((subtask, index) => (
              <article
                key={`${index}-${subtask.itemType}`}
                className="rounded-[10px] border border-sahara-border bg-sahara-surface p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 flex size-5 shrink-0 rounded-[5px] border border-sahara-text-muted/55 bg-sahara-surface"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`recurring-subtask-${index}`}
                      className="sr-only"
                    >
                      子任务 {index + 1} 名称
                    </label>
                    <div className="flex min-w-0 items-center">
                      {subtask.itemType === "focus" && (
                        <span className="task-pomo-label task-pomo-not-started shrink-0 text-sm font-medium">
                          专注：
                        </span>
                      )}
                      <input
                        id={`recurring-subtask-${index}`}
                        name={`recurring-subtask-${index}`}
                        type="text"
                        autoComplete="off"
                        value={subtask.name}
                        onChange={(event) =>
                          updateTemplateSubtask(index, {
                            name: event.target.value,
                          })}
                        className="h-8 min-w-0 flex-1 bg-transparent px-0.5 text-sm text-sahara-text outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-sahara-focus"
                      />
                    </div>
                    {subtask.itemType === "focus" && (
                      <p className="task-pomo-label task-pomo-not-started mt-0.5 font-mono text-[11px] font-semibold tabular-nums">
                        0/{subtask.estimatedPomos}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    intent="default"
                    size="xs"
                    aria-label={`${
                      subtask.itemType === "focus" ? "改为待办" : "设为专注"
                    }：${subtask.name}`}
                    onClick={() =>
                      updateTemplateSubtask(index, {
                        itemType: subtask.itemType === "focus"
                          ? "todo"
                          : "focus",
                        estimatedPomos: 1,
                      })}
                    className="min-h-10 shrink-0 touch-manipulation"
                  >
                    {subtask.itemType === "focus" ? "改为待办" : "设为专注"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    intent="red"
                    size="icon-sm"
                    aria-label={`删除模板子任务：${subtask.name}`}
                    title={`删除模板子任务：${subtask.name}`}
                    onClick={() => removeTemplateSubtask(index)}
                    className="min-h-10 min-w-10 shrink-0 touch-manipulation"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>

                {subtask.itemType === "focus" && (
                  <div
                    role="group"
                    aria-label={`设置子任务番茄数：${subtask.name}`}
                    className="mt-3 grid grid-cols-4 gap-2 border-t border-sahara-border pt-3"
                  >
                    {POMODORO_OPTIONS.map((pomos) => {
                      const selected = subtask.estimatedPomos === pomos;
                      return (
                        <button
                          key={pomos}
                          type="button"
                          aria-label={`子任务 ${subtask.name} 预计 ${pomos} 个番茄`}
                          aria-pressed={selected}
                          onClick={() =>
                            updateTemplateSubtask(index, {
                              estimatedPomos: pomos,
                            })}
                          className={`h-10 touch-manipulation rounded-md border text-sm font-semibold tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus ${
                            selected
                              ? "border-sahara-text bg-sahara-card text-sahara-text"
                              : "border-sahara-border bg-sahara-surface text-sahara-text-secondary hover:bg-sahara-card"
                          }`}
                        >
                          {pomos}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="solid"
          intent="sahara"
          size="md"
          fullWidth
          onClick={returnToMain}
          disabled={form.subtasks.some((subtask) => !subtask.name.trim())}
          className="touch-manipulation"
        >
          完成子任务设置
        </Button>
      </section>
    </>
  );

  const renderAttributesView = () => (
    <>
      <DialogHeader
        title="任务属性"
        description="项目和分类会跟随模板写入之后生成的任务。"
        onBack={returnToMain}
        onClose={closeDialog}
        backButtonRef={backButtonRef}
      />

      <section className="space-y-5" aria-label="编辑任务属性">
        <div>
          <label
            htmlFor="recurring-task-project"
            className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
          >
            项目{" "}
            <span className="font-normal text-sahara-text-muted">（可选）</span>
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
            分类{" "}
            <span className="font-normal text-sahara-text-muted">（可选）</span>
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

        <Button
          type="button"
          variant="solid"
          intent="sahara"
          size="md"
          fullWidth
          onClick={returnToMain}
        >
          完成任务属性
        </Button>
      </section>
    </>
  );

  const renderScheduleView = () => (
    <>
      <DialogHeader
        title="循环设置"
        description="只设置任务何时生成，不改变任务本身的规则。"
        onBack={returnToMain}
        onClose={closeDialog}
        backButtonRef={backButtonRef}
      />

      <section className="space-y-5" aria-label="编辑循环设置">
        <div>
          <h4
            id="recurring-task-frequency-label"
            className="mb-2 text-xs font-medium text-sahara-text-secondary"
          >
            循环频率
          </h4>
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
                  className={`h-11 touch-manipulation rounded-md border px-2 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus last:col-span-2 sm:last:col-span-1 ${
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

        <div className="grid gap-4 sm:grid-cols-2">
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

        <Button
          type="button"
          variant="solid"
          intent="sahara"
          size="md"
          fullWidth
          onClick={returnToMain}
        >
          完成循环设置
        </Button>
      </section>
    </>
  );

  const renderRulesView = () => (
    <>
      <DialogHeader
        title="已配置规则"
        description="管理模板不会改写已经生成的任务；自定义规则可以删除。"
        onBack={returnToMain}
        onClose={closeDialog}
        backButtonRef={backButtonRef}
      />

      {rules.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-sahara-border bg-sahara-card/45 px-4 py-8 text-center">
          <Repeat2
            aria-hidden="true"
            className="mx-auto size-5 text-sahara-text-muted"
          />
          <p className="mt-2 text-xs font-medium text-sahara-text">
            还没有已配置规则
          </p>
          <p className="mt-1 text-[11px] text-sahara-text-muted">
            返回后可创建第一条循环任务。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const enabled = rule.enabled === 1;
            const itemType = getRecurringTaskItemType(rule);
            const customRule = isCustomRecurringTaskRule(rule);
            return (
              <article
                key={rule.id}
                className="flex min-w-0 items-center gap-3 rounded-[10px] border border-sahara-border bg-sahara-surface px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  {itemType === "focus" ? (
                    <Focus
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-sahara-text-secondary"
                    />
                  ) : (
                    <ListTodo
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-sahara-text-secondary"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        className="truncate text-xs font-medium text-sahara-text"
                        title={rule.name}
                      >
                        {itemType === "focus" && (
                          <span className="task-pomo-label task-pomo-not-started">
                            专注：
                          </span>
                        )}
                        {rule.name}
                      </p>
                      {!enabled && (
                        <span className="shrink-0 rounded-full bg-sahara-card px-1.5 py-0.5 text-[10px] text-sahara-text-muted">
                          已停用
                        </span>
                      )}
                      {!customRule && (
                        <span className="shrink-0 rounded-full bg-sahara-card px-1.5 py-0.5 text-[10px] text-sahara-text-muted">
                          内置
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-sahara-text-muted">
                      {itemType === "focus" && (
                        <span className="mr-1.5 font-mono font-semibold tabular-nums text-sahara-text-secondary">
                          0/{rule.estimated_pomos}
                        </span>
                      )}
                      {formatRecurringRuleSummary(
                        getRecurringTaskSchedule(rule),
                        rule.start_date,
                        rule.scheduled_time,
                      )}
                    </p>
                  </div>
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
                  {customRule && onDeleteRule && (
                    <Button
                      type="button"
                      variant="ghost"
                      intent="red"
                      size="icon-sm"
                      aria-label={`删除循环规则：${rule.name}`}
                      title={`删除循环规则：${rule.name}`}
                      disabled={
                        submitting
                        || togglingRuleId !== null
                        || deletingRuleId !== null
                      }
                      onClick={() => beginDeleting(rule)}
                      className="min-h-10 min-w-10 shrink-0 touch-manipulation"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {submitError && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-xs font-medium text-[#b42318]"
        >
          {submitError}
        </p>
      )}
      {submitSuccess && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-xs font-medium text-sahara-text-secondary"
        >
          {submitSuccess}
        </p>
      )}
    </>
  );

  const renderDeleteView = () => {
    if (!rulePendingDelete) return null;

    return (
      <>
        <DialogHeader
          title="删除循环任务？"
          description="删除后不会再按这条规则生成新任务。"
          onBack={cancelDeleting}
          onClose={closeDialog}
          backButtonRef={backButtonRef}
        />

        <div className="rounded-[10px] border border-[#b42318]/25 bg-[#b42318]/6 px-4 py-4">
          <p className="break-words text-sm font-medium text-sahara-text">
            {rulePendingDelete.name}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-sahara-text-secondary">
            已经生成的普通任务和专注记录会保留；只有循环模板会被删除。
          </p>
        </div>

        {submitError && (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-xs font-medium text-[#b42318]"
          >
            {submitError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            intent="default"
            size="md"
            fullWidth
            onClick={cancelDeleting}
            disabled={deletingRuleId !== null}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            intent="red"
            size="md"
            fullWidth
            onClick={() => void handleDeleteRule()}
            disabled={deletingRuleId !== null}
          >
            {deletingRuleId === rulePendingDelete.id
              ? "正在删除…"
              : "删除循环任务"}
          </Button>
        </div>
      </>
    );
  };

  return (
    <ModalOverlay
      open={open}
      onClose={handleLayerDismiss}
      maxWidth="max-w-lg"
      ariaLabel={
        activeView === "main"
          ? mainDialogLabel
          : activeView === "delete"
            ? "确认删除循环任务"
            : CHILD_VIEW_LABELS[activeView]
      }
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-5 md:p-6">
        {activeView === "main" && renderMainView()}
        {activeView === "focus" && renderFocusView()}
        {activeView === "subtasks" && renderSubtasksView()}
        {activeView === "attributes" && renderAttributesView()}
        {activeView === "schedule" && renderScheduleView()}
        {activeView === "rules" && renderRulesView()}
        {activeView === "delete" && renderDeleteView()}
      </div>
    </ModalOverlay>
  );
}
