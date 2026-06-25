import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  FolderTree,
  Loader2,
  Milestone,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { TimePage, WeekPlanItem } from "@/lib/db";
import { addTaskActivityLog } from "@/lib/db";
import { getWeekDateRangeFromKey, toLocalISODate } from "@/lib/time-pages";
import { isTaskDone } from "@/features/tasks/task-completion";
import type { Task } from "@/features/tasks/task-types";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTimePageStore } from "@/features/time-pages/use-time-page-store";

const MarkdownNoteEditor = lazy(() => import("./markdown-note-editor"));

type SaveState = "idle" | "saving" | "saved";

type TaskGroup = {
  id: number | "other";
  title: string;
  tasks: Task[];
};

const OTHER_GROUP_TITLE = "临时任务 / 其他";

function dateKeyFromValue(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function isDateInRange(dateKey: string | null, start: string, end: string): boolean {
  if (!dateKey) return false;
  return dateKey >= start && dateKey <= end;
}

function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)} · ${year}`;
}

function formatPageType(type: TimePage["type"]): string {
  switch (type) {
    case "overview":
      return "总览";
    case "year":
      return "年";
    case "month":
      return "月";
    case "week":
      return "周";
    case "day":
      return "日";
  }
}

function buildTaskGroups(tasks: Task[], weekPlanItems: WeekPlanItem[]): TaskGroup[] {
  const groups: TaskGroup[] = weekPlanItems.map((item) => ({
    id: item.id,
    title: item.title,
    tasks: [],
  }));
  const otherGroup: TaskGroup = { id: "other", title: OTHER_GROUP_TITLE, tasks: [] };

  for (const task of tasks) {
    const group = groups.find((item) => item.id === task.week_plan_item_id);
    if (group) group.tasks.push(task);
    else otherGroup.tasks.push(task);
  }

  return [...groups.filter((group) => group.tasks.length > 0), ...(otherGroup.tasks.length > 0 ? [otherGroup] : [])];
}

function getWeekPlanTitle(
  task: Task,
  weekPlanItems: WeekPlanItem[],
): string {
  return (
    weekPlanItems.find((item) => item.id === task.week_plan_item_id)?.title ??
    OTHER_GROUP_TITLE
  );
}

interface PageTreeButtonProps {
  page: TimePage;
  active: boolean;
  depth: number;
  onClick: () => void;
}

function PageTreeButton({ page, active, depth, onClick }: PageTreeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-sahara-primary-light text-sahara-primary font-bold"
          : "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
      )}
      style={{ paddingLeft: `${12 + depth * 18}px` }}
    >
      {page.type === "overview" ? (
        <FolderTree className="size-4 shrink-0" />
      ) : page.type === "day" ? (
        <FileText className="size-4 shrink-0" />
      ) : (
        <CalendarDays className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{page.title}</span>
      <span className="text-[10px] text-sahara-text-muted shrink-0">
        {formatPageType(page.type)}
      </span>
    </button>
  );
}

interface TaskCardProps {
  task: Task;
  groupTitle: string;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocus: () => void;
  onMoveToday: () => void;
  onMoveTomorrow: () => void;
  onMoveCustomDate: () => void;
}

function TaskCard({
  task,
  groupTitle,
  onComplete,
  onEdit,
  onDelete,
  onFocus,
  onMoveToday,
  onMoveTomorrow,
  onMoveCustomDate,
}: TaskCardProps) {
  const done = isTaskDone(task);

  return (
    <div
      className={cn(
        "rounded-2xl border border-sahara-border/20 bg-sahara-surface p-4 shadow-sm shadow-sahara-primary/5",
        done && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onComplete}
          disabled={done}
          className="mt-1 text-sahara-primary disabled:text-green-500 disabled:cursor-default cursor-pointer"
          title={done ? "已完成" : "完成任务"}
        >
          {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-sahara-primary-light px-2 py-0.5 text-[10px] font-bold text-sahara-primary">
              {groupTitle}
            </span>
            {task.project && (
              <span className="rounded-full bg-sahara-card px-2 py-0.5 text-[10px] font-bold text-sahara-text-muted">
                {task.project}
              </span>
            )}
          </div>
          <h4
            className={cn(
              "mt-2 font-serif text-lg leading-snug text-sahara-text",
              done && "line-through text-sahara-text-muted",
            )}
          >
            {task.name}
          </h4>
          <div className="mt-2 flex items-center gap-3 text-xs font-bold text-sahara-text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              {task.completed_pomos}/{task.estimated_pomos} 个番茄
            </span>
            {task.scheduled_for && <span>{dateKeyFromValue(task.scheduled_for)}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pl-8">
        {!done && (
          <>
            <Button variant="outline" intent="sahara" size="xs" shape="rounded-full" onClick={onFocus}>
              专注
            </Button>
            <Button variant="outline" intent="default" size="xs" shape="rounded-full" onClick={onMoveToday}>
              迁移到今天
            </Button>
            <Button variant="outline" intent="default" size="xs" shape="rounded-full" onClick={onMoveTomorrow}>
              迁移到明天
            </Button>
            <Button variant="outline" intent="default" size="xs" shape="rounded-full" onClick={onMoveCustomDate}>
              指定日期
            </Button>
          </>
        )}
        <Button variant="ghost" intent="default" size="xs" shape="rounded-full" onClick={onEdit}>
          编辑
        </Button>
        <Button variant="ghost" intent="red" size="xs" shape="rounded-full" onClick={onDelete}>
          删除
        </Button>
      </div>
    </div>
  );
}

interface TaskGroupsProps {
  groups: TaskGroup[];
  emptyLabel: string;
  weekPlanItems: WeekPlanItem[];
  onCompleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onFocusTask: (task: Task) => void;
  onMoveTask: (task: Task, dateKey: string) => void;
  onMoveTaskCustomDate: (task: Task) => void;
}

function TaskGroups({
  groups,
  emptyLabel,
  weekPlanItems,
  onCompleteTask,
  onEditTask,
  onDeleteTask,
  onFocusTask,
  onMoveTask,
  onMoveTaskCustomDate,
}: TaskGroupsProps) {
  const today = toLocalISODate(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalISODate(tomorrowDate);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sahara-border/40 bg-sahara-card/40 p-8 text-center">
        <p className="text-sm font-bold text-sahara-text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="mb-2 flex items-center gap-2">
            <Milestone className="size-4 text-sahara-primary" />
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-sahara-text-muted">
              {group.title}（{group.tasks.length}）
            </h3>
          </div>
          <div className="space-y-3">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                groupTitle={getWeekPlanTitle(task, weekPlanItems)}
                onComplete={() => onCompleteTask(task)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task)}
                onFocus={() => onFocusTask(task)}
                onMoveToday={() => onMoveTask(task, today)}
                onMoveTomorrow={() => onMoveTask(task, tomorrow)}
                onMoveCustomDate={() => onMoveTaskCustomDate(task)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface WeekPlanEditorProps {
  weekPlanItems: WeekPlanItem[];
  onAdd: (title: string) => Promise<void>;
  onRename: (id: number, title: string) => Promise<void>;
  onArchive: (id: number) => Promise<void>;
}

function WeekPlanEditor({
  weekPlanItems,
  onAdd,
  onRename,
  onArchive,
}: WeekPlanEditorProps) {
  const [title, setTitle] = useState("");

  const handleAdd = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setTitle("");
  };

  return (
    <section className="rounded-3xl border border-sahara-border/20 bg-sahara-card/35 p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
            Week Plan
          </p>
          <h2 className="font-serif text-2xl text-sahara-text">周计划</h2>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleAdd();
          }}
          placeholder="新增一个周计划条目，例如：时间管家记录系统"
          className="min-w-0 flex-1 rounded-2xl border border-sahara-border/20 bg-sahara-surface px-4 py-3 text-sm text-sahara-text outline-none transition-all placeholder:text-sahara-text-muted/50 focus:border-sahara-primary/40 focus:ring-2 focus:ring-sahara-primary/10"
        />
        <Button
          variant="solid"
          intent="sahara"
          size="sm"
          shape="rounded-full"
          onClick={() => void handleAdd()}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          添加
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {weekPlanItems.length > 0 ? (
          weekPlanItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-2xl border border-sahara-border/15 bg-sahara-surface px-3 py-2"
            >
              <span className="size-2 rounded-full bg-sahara-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-sahara-text">
                {item.title}
              </span>
              <Button
                variant="ghost"
                intent="default"
                size="icon-sm"
                shape="rounded-full"
                onClick={() => {
                  const nextTitle = window.prompt("修改周计划条目", item.title);
                  if (nextTitle !== null) void onRename(item.id, nextTitle);
                }}
                title="修改"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                intent="red"
                size="icon-sm"
                shape="rounded-full"
                onClick={() => {
                  if (window.confirm(`删除「${item.title}」？相关任务会进入临时任务 / 其他。`)) {
                    void onArchive(item.id);
                  }
                }}
                title="删除"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-sahara-border/30 bg-sahara-surface/50 px-4 py-4 text-sm text-sahara-text-muted">
            还没有周计划。先写 1-3 个本周主线，日任务会默认挂到这些主线下面。
          </p>
        )}
      </div>
    </section>
  );
}

interface DayTaskCreatorProps {
  dayKey: string;
  weekPlanItems: WeekPlanItem[];
  onAddTask: (
    name: string,
    estimatedPomos: number,
    project: string,
    weekPlanItemId: number | null,
  ) => Promise<void>;
}

function DayTaskCreator({ dayKey, weekPlanItems, onAddTask }: DayTaskCreatorProps) {
  const [name, setName] = useState("");
  const [estimatedPomos, setEstimatedPomos] = useState(1);
  const [project, setProject] = useState("");
  const [weekPlanItemId, setWeekPlanItemId] = useState<string>("other");

  useEffect(() => {
    setWeekPlanItemId((current) => {
      if (current !== "other" && weekPlanItems.some((item) => String(item.id) === current)) {
        return current;
      }
      return weekPlanItems[0] ? String(weekPlanItems[0].id) : "other";
    });
  }, [weekPlanItems]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (estimatedPomos > 4) {
      const confirmed = window.confirm("这个任务预计超过 4 个番茄，建议拆分。仍然作为一个任务添加吗？");
      if (!confirmed) return;
    }
    await onAddTask(
      trimmed,
      estimatedPomos,
      project.trim(),
      weekPlanItemId === "other" ? null : Number(weekPlanItemId),
    );
    setName("");
    setEstimatedPomos(1);
  };

  return (
    <section className="rounded-3xl border border-sahara-border/20 bg-sahara-card/35 p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
            Daily Task
          </p>
          <h2 className="font-serif text-2xl text-sahara-text">今日任务</h2>
          <p className="mt-1 text-xs text-sahara-text-muted">
            新任务会进入 {formatShortDate(dayKey)}，并默认挂到本周计划。
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_8rem_10rem_12rem_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleAdd();
          }}
          placeholder="输入今天要做的任务"
          className="min-w-0 rounded-2xl border border-sahara-border/20 bg-sahara-surface px-4 py-3 text-sm text-sahara-text outline-none transition-all placeholder:text-sahara-text-muted/50 focus:border-sahara-primary/40 focus:ring-2 focus:ring-sahara-primary/10"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={estimatedPomos}
          onChange={(event) => setEstimatedPomos(Math.max(1, Number(event.target.value) || 1))}
          className="rounded-2xl border border-sahara-border/20 bg-sahara-surface px-4 py-3 text-sm text-sahara-text outline-none transition-all focus:border-sahara-primary/40 focus:ring-2 focus:ring-sahara-primary/10"
          aria-label="预计番茄数"
          title="预计番茄数"
        />
        <input
          value={project}
          onChange={(event) => setProject(event.target.value)}
          placeholder="项目，可选"
          className="rounded-2xl border border-sahara-border/20 bg-sahara-surface px-4 py-3 text-sm text-sahara-text outline-none transition-all placeholder:text-sahara-text-muted/50 focus:border-sahara-primary/40 focus:ring-2 focus:ring-sahara-primary/10"
        />
        <select
          value={weekPlanItemId}
          onChange={(event) => setWeekPlanItemId(event.target.value)}
          className="rounded-2xl border border-sahara-border/20 bg-sahara-surface px-4 py-3 text-sm text-sahara-text outline-none transition-all focus:border-sahara-primary/40 focus:ring-2 focus:ring-sahara-primary/10"
        >
          {weekPlanItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
          <option value="other">{OTHER_GROUP_TITLE}</option>
        </select>
        <Button
          variant="solid"
          intent="sahara"
          size="sm"
          shape="rounded-full"
          onClick={() => void handleAdd()}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          添加
        </Button>
      </div>
    </section>
  );
}

interface MarkdownSectionProps {
  activePage: TimePage;
  draftContent: string;
  saveLabel: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function MarkdownSection({
  activePage,
  draftContent,
  saveLabel,
  onChange,
  onBlur,
}: MarkdownSectionProps) {
  return (
    <section className="min-h-[30rem] overflow-hidden rounded-3xl border border-sahara-border/20 bg-sahara-surface shadow-sm shadow-sahara-primary/5">
      <div className="border-b border-sahara-border/20 px-5 py-4 md:px-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
              Markdown
            </p>
            <h2 className="font-serif text-2xl text-sahara-text">自由记录区</h2>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sahara-text-muted">
            <Save className="size-3.5" />
            <span>{saveLabel}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-sahara-text-muted">
          当前页面：{activePage.title}
        </p>
      </div>
      <div className="h-[32rem] notes-markdown-editor">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sahara-text-muted">
              <Loader2 className="size-5 animate-spin" />
            </div>
          }
        >
          <MarkdownNoteEditor
            value={draftContent}
            onChange={onChange}
            onBlur={onBlur}
          />
        </Suspense>
      </div>
    </section>
  );
}

export function TimePlanningWorkspace() {
  const navigate = useNavigate();
  const pages = useTimePageStore((state) => state.pages);
  const weekPlanItems = useTimePageStore((state) => state.weekPlanItems);
  const activePageId = useTimePageStore((state) => state.activePageId);
  const workspaceKeys = useTimePageStore((state) => state.workspaceKeys);
  const overviewPageId = useTimePageStore((state) => state.overviewPageId);
  const yearPageId = useTimePageStore((state) => state.yearPageId);
  const monthPageId = useTimePageStore((state) => state.monthPageId);
  const weekPageId = useTimePageStore((state) => state.weekPageId);
  const dayPageId = useTimePageStore((state) => state.dayPageId);
  const loading = useTimePageStore((state) => state.loading);
  const error = useTimePageStore((state) => state.error);
  const loadWorkspace = useTimePageStore((state) => state.loadWorkspace);
  const selectPage = useTimePageStore((state) => state.selectPage);
  const updatePageContent = useTimePageStore((state) => state.updatePageContent);
  const addWeekPlanItem = useTimePageStore((state) => state.addWeekPlanItem);
  const updateWeekPlanItemTitle = useTimePageStore((state) => state.updateWeekPlanItemTitle);
  const archiveWeekPlanItem = useTimePageStore((state) => state.archiveWeekPlanItem);

  const tasks = useTaskStore((state) => state.tasks);
  const loadTasks = useTaskStore((state) => state.loadTasks);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const setActiveTask = useTimerStore((state) => state.setActiveTask);

  const [draftPageId, setDraftPageId] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? null,
    [activePageId, pages],
  );

  const pageTree = useMemo(() => {
    const byId = new Map(pages.map((page) => [page.id, page]));
    const orderedIds = [overviewPageId, yearPageId, monthPageId, weekPageId, dayPageId]
      .filter((id): id is number => typeof id === "number")
      .filter((id, index, ids) => ids.indexOf(id) === index);

    return orderedIds
      .map((id) => byId.get(id))
      .filter((page): page is TimePage => Boolean(page));
  }, [dayPageId, monthPageId, overviewPageId, pages, weekPageId, yearPageId]);

  const currentDayTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !isTaskDone(task) &&
          dateKeyFromValue(task.scheduled_for) === workspaceKeys.day,
      ),
    [tasks, workspaceKeys.day],
  );

  const overdueTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (isTaskDone(task)) return false;
        const taskDate = dateKeyFromValue(task.scheduled_for);
        return !taskDate || taskDate < workspaceKeys.day;
      }),
    [tasks, workspaceKeys.day],
  );

  const activeDayKey = activePage?.type === "day" ? activePage.date_key : workspaceKeys.day;
  const activeDayTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !isTaskDone(task) && dateKeyFromValue(task.scheduled_for) === activeDayKey,
      ),
    [activeDayKey, tasks],
  );

  const weekRange = useMemo(() => {
    if (activePage?.type === "week") {
      return getWeekDateRangeFromKey(activePage.date_key) ?? {
        start: workspaceKeys.weekStart,
        end: workspaceKeys.weekEnd,
      };
    }
    return { start: workspaceKeys.weekStart, end: workspaceKeys.weekEnd };
  }, [activePage?.date_key, activePage?.type, workspaceKeys.weekEnd, workspaceKeys.weekStart]);

  const completedWeekTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!isTaskDone(task)) return false;
        return isDateInRange(
          dateKeyFromValue(task.completed_at),
          weekRange.start,
          weekRange.end,
        );
      }),
    [tasks, weekRange.end, weekRange.start],
  );

  const activeDayGroups = useMemo(
    () => buildTaskGroups(activeDayTasks, weekPlanItems),
    [activeDayTasks, weekPlanItems],
  );
  const overdueGroups = useMemo(
    () => buildTaskGroups(overdueTasks, weekPlanItems),
    [overdueTasks, weekPlanItems],
  );
  const completedWeekGroups = useMemo(
    () => buildTaskGroups(completedWeekTasks, weekPlanItems),
    [completedWeekTasks, weekPlanItems],
  );

  useEffect(() => {
    void loadWorkspace();
    void loadTasks();
  }, [loadTasks, loadWorkspace]);

  useEffect(() => {
    if (!activePage) {
      setDraftPageId(null);
      setDraftContent("");
      setSaveState("idle");
      return;
    }
    setDraftPageId(activePage.id);
    setDraftContent(activePage.content);
    setSaveState("saved");
  }, [activePage?.id]);

  const persistDraft = useCallback(async () => {
    if (!activePage || draftPageId !== activePage.id) return;
    if (draftContent === activePage.content) return;
    setSaveState("saving");
    await updatePageContent(activePage.id, draftContent);
    setSaveState("saved");
  }, [activePage, draftContent, draftPageId, updatePageContent]);

  useEffect(() => {
    if (!activePage || draftPageId !== activePage.id) return;
    if (draftContent === activePage.content) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activePage, draftContent, draftPageId, persistDraft]);

  const handleSelectPage = async (pageId: number) => {
    await persistDraft();
    selectPage(pageId);
  };

  const handleAddTask = async (
    name: string,
    estimatedPomos: number,
    project: string,
    weekPlanItemId: number | null,
  ) => {
    await addTask(
      name,
      estimatedPomos,
      project,
      "",
      null,
      activeDayKey,
      weekPlanItemId,
    );
  };

  const handleCompleteTask = async (task: Task) => {
    const actualPomos = Math.max(task.completed_pomos, task.estimated_pomos, 1);
    await completeTask(task.id, actualPomos, "");
    await setActiveTask(null);
  };

  const handleEditTask = async (task: Task) => {
    const nextName = window.prompt("修改任务名称", task.name);
    if (nextName === null) return;
    const trimmedName = nextName.trim();
    if (!trimmedName) return;

    const nextPomosText = window.prompt("修改预计番茄数", String(task.estimated_pomos));
    if (nextPomosText === null) return;
    const nextPomos = Math.max(1, Number(nextPomosText) || task.estimated_pomos);

    await updateTask(task.id, trimmedName, nextPomos);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm(`删除任务「${task.name}」？`)) return;
    await deleteTask(task.id);
  };

  const handleFocusTask = async (task: Task) => {
    await setActiveTask(task.id);
    navigate("/");
  };

  const handleMoveTask = async (task: Task, dateKey: string) => {
    const previousDate = task.scheduled_for ?? null;
    const keepWeekPlan = isDateInRange(dateKey, workspaceKeys.weekStart, workspaceKeys.weekEnd)
      ? task.week_plan_item_id ?? null
      : null;
    await updateTask(
      task.id,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dateKey,
      keepWeekPlan,
    );
    await addTaskActivityLog(task.id, "moved_date", previousDate, dateKey);
  };

  const handleMoveTaskCustomDate = async (task: Task) => {
    const nextDate = window.prompt("迁移到哪一天？请输入 YYYY-MM-DD", workspaceKeys.day);
    if (!nextDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      window.alert("日期格式需要是 YYYY-MM-DD");
      return;
    }
    await handleMoveTask(task, nextDate);
  };

  const saveLabel = saveState === "saving" ? "保存中" : saveState === "saved" ? "已保存" : "";

  if (loading && pages.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center text-sahara-text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!activePage) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center text-center">
        <FolderTree className="mb-4 size-12 text-sahara-border" />
        <p className="text-sm font-bold text-sahara-text-muted">时间计划工作台还没有准备好</p>
        {error && <p className="mt-2 max-w-md text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <div className="mb-6 md:mb-8">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
          记录
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl text-sahara-text md:text-5xl">
              时间计划工作台
            </h1>
            <p className="mt-2 text-sm text-sahara-text-muted">
              总览 → 年 → 月 → 周 → 日。日页面新增任务，周页面自动汇总完成。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {overviewPageId && (
              <Button variant="outline" intent="default" size="sm" shape="rounded-full" onClick={() => void handleSelectPage(overviewPageId)}>
                总览
              </Button>
            )}
            {dayPageId && (
              <Button variant="solid" intent="sahara" size="sm" shape="rounded-full" onClick={() => void handleSelectPage(dayPageId)}>
                进入今天
              </Button>
            )}
            {weekPageId && (
              <Button variant="outline" intent="sahara" size="sm" shape="rounded-full" onClick={() => void handleSelectPage(weekPageId)}>
                本周
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <aside className="min-h-64 rounded-3xl border border-sahara-border/20 bg-sahara-surface p-3 shadow-sm shadow-sahara-primary/5 lg:min-h-0">
          <div className="mb-3 flex items-center gap-2 px-2 pt-2">
            <FolderTree className="size-4 text-sahara-primary" />
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
              页面树
            </h2>
          </div>
          <div className="space-y-1">
            {pageTree.map((page, index) => (
              <PageTreeButton
                key={page.id}
                page={page}
                active={page.id === activePage.id}
                depth={index}
                onClick={() => void handleSelectPage(page.id)}
              />
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-sahara-card/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sahara-text-muted">
              当前链路
            </p>
            <div className="mt-3 space-y-2 text-sm text-sahara-text-secondary">
              <div className="flex items-center justify-between gap-2">
                <span>今年</span>
                <span className="font-bold text-sahara-text">{workspaceKeys.year}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>本月</span>
                <span className="font-bold text-sahara-text">{workspaceKeys.month}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>本周</span>
                <span className="font-bold text-sahara-text">{workspaceKeys.week}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>今天</span>
                <span className="font-bold text-sahara-text">{workspaceKeys.day}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-3xl border border-sahara-border/20 bg-sahara-surface px-5 py-5 shadow-sm shadow-sahara-primary/5 md:px-7 md:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
                  {formatPageType(activePage.type)}页面
                </p>
                <h2 className="mt-1 truncate font-serif text-3xl text-sahara-text md:text-4xl">
                  {activePage.title}
                </h2>
              </div>
              <ChevronRight className="mt-3 size-5 shrink-0 text-sahara-border" />
            </div>
          </section>

          {activePage.type === "overview" && (
            <section className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => dayPageId && void handleSelectPage(dayPageId)}
                className="rounded-3xl border border-sahara-border/20 bg-sahara-surface p-5 text-left shadow-sm shadow-sahara-primary/5 transition-colors hover:border-sahara-primary/30"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">Today</p>
                <h3 className="mt-2 font-serif text-2xl text-sahara-text">今日任务</h3>
                <p className="mt-2 text-sm font-bold text-sahara-primary">{currentDayTasks.length} 个待完成</p>
              </button>
              <button
                type="button"
                onClick={() => weekPageId && void handleSelectPage(weekPageId)}
                className="rounded-3xl border border-sahara-border/20 bg-sahara-surface p-5 text-left shadow-sm shadow-sahara-primary/5 transition-colors hover:border-sahara-primary/30"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">Week</p>
                <h3 className="mt-2 font-serif text-2xl text-sahara-text">本周完成</h3>
                <p className="mt-2 text-sm font-bold text-green-600">{completedWeekTasks.length} 个已完成</p>
              </button>
              <div className="rounded-3xl border border-sahara-border/20 bg-sahara-surface p-5 shadow-sm shadow-sahara-primary/5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">Plan</p>
                <h3 className="mt-2 font-serif text-2xl text-sahara-text">周计划</h3>
                <p className="mt-2 text-sm font-bold text-sahara-primary">{weekPlanItems.length} 条主线</p>
              </div>
            </section>
          )}

          {activePage.type === "week" && (
            <>
              <WeekPlanEditor
                weekPlanItems={weekPlanItems}
                onAdd={addWeekPlanItem}
                onRename={updateWeekPlanItemTitle}
                onArchive={archiveWeekPlanItem}
              />
              <section className="rounded-3xl border border-sahara-border/20 bg-sahara-card/35 p-5 md:p-6">
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
                    Done This Week
                  </p>
                  <h2 className="font-serif text-2xl text-sahara-text">本周完成任务</h2>
                  <p className="mt-1 text-xs text-sahara-text-muted">
                    统计范围：{weekRange.start} 至 {weekRange.end}
                  </p>
                </div>
                <TaskGroups
                  groups={completedWeekGroups}
                  emptyLabel="这周还没有完成任务。完成日任务后，会自动汇总到这里。"
                  weekPlanItems={weekPlanItems}
                  onCompleteTask={handleCompleteTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onFocusTask={handleFocusTask}
                  onMoveTask={handleMoveTask}
                  onMoveTaskCustomDate={handleMoveTaskCustomDate}
                />
              </section>
            </>
          )}

          {activePage.type === "day" && (
            <>
              <DayTaskCreator
                dayKey={activeDayKey}
                weekPlanItems={weekPlanItems}
                onAddTask={handleAddTask}
              />
              <section className="rounded-3xl border border-sahara-border/20 bg-sahara-card/35 p-5 md:p-6">
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
                    Tasks For The Day
                  </p>
                  <h2 className="font-serif text-2xl text-sahara-text">{formatShortDate(activeDayKey)} 待办</h2>
                </div>
                <TaskGroups
                  groups={activeDayGroups}
                  emptyLabel="今天还没有任务。可以在上方添加一个任务。"
                  weekPlanItems={weekPlanItems}
                  onCompleteTask={handleCompleteTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onFocusTask={handleFocusTask}
                  onMoveTask={handleMoveTask}
                  onMoveTaskCustomDate={handleMoveTaskCustomDate}
                />
              </section>

              {overdueTasks.length > 0 && (
                <section className="rounded-3xl border border-amber-200/50 bg-amber-50/30 p-5 md:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Send className="size-4 text-amber-700" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700/80">
                        Need Migration
                      </p>
                      <h2 className="font-serif text-2xl text-sahara-text">待迁移任务</h2>
                    </div>
                  </div>
                  <TaskGroups
                    groups={overdueGroups}
                    emptyLabel="没有待迁移任务。"
                    weekPlanItems={weekPlanItems}
                    onCompleteTask={handleCompleteTask}
                    onEditTask={handleEditTask}
                    onDeleteTask={handleDeleteTask}
                    onFocusTask={handleFocusTask}
                    onMoveTask={handleMoveTask}
                    onMoveTaskCustomDate={handleMoveTaskCustomDate}
                  />
                </section>
              )}
            </>
          )}

          {(activePage.type === "year" || activePage.type === "month") && (
            <section className="rounded-3xl border border-sahara-border/20 bg-sahara-card/35 p-5 md:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
                Planning Level
              </p>
              <h2 className="mt-1 font-serif text-2xl text-sahara-text">
                {activePage.type === "year" ? "年度方向" : "月度计划"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-sahara-text-muted">
                这一层主要用于计划和复盘，不直接新增任务。任务统一在日页面新增，再由周页面自动汇总。
              </p>
            </section>
          )}

          <MarkdownSection
            activePage={activePage}
            draftContent={draftContent}
            saveLabel={saveLabel}
            onChange={setDraftContent}
            onBlur={() => void persistDraft()}
          />
        </main>
      </div>
    </div>
  );
}
