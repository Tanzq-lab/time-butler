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
  Circle,
  Clock3,
  FileText,
  FolderTree,
  Loader2,
  Milestone,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/cn";
import type { TimePage, WeekPlanItem } from "@/lib/db";
import { addTaskActivityLog } from "@/lib/db";
import { getWeekDateRangeFromKey, toLocalISODate } from "@/lib/time-pages";
import { isTaskDone } from "@/features/tasks/task-completion";
import type { Task } from "@/features/tasks/task-types";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTimePageStore } from "@/features/time-pages/use-time-page-store";

const DocumentNoteEditor = lazy(() => import("./document-note-editor"));

type SaveState = "idle" | "saving" | "saved";

type TaskGroup = {
  id: number | "other";
  title: string;
  tasks: Task[];
};

type PageTreeItem = {
  page: TimePage;
  depth: number;
};

const OTHER_GROUP_TITLE = "临时任务 / 其他";

const PAGE_TYPE_ORDER: Record<TimePage["type"], number> = {
  overview: 0,
  year: 1,
  month: 2,
  week: 3,
  day: 4,
};

function dateKeyFromValue(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function isDateInRange(dateKey: string | null, start: string, end: string): boolean {
  if (!dateKey) return false;
  return dateKey >= start && dateKey <= end;
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

function compareTimePages(a: TimePage, b: TimePage): number {
  const typeDiff = PAGE_TYPE_ORDER[a.type] - PAGE_TYPE_ORDER[b.type];
  if (typeDiff !== 0) return typeDiff;
  return b.date_key.localeCompare(a.date_key);
}

function buildPageTree(pages: TimePage[], overviewPageId: number | null): PageTreeItem[] {
  const childrenByParent = new Map<number | null, TimePage[]>();
  for (const page of pages) {
    const parentId = page.parent_id ?? null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareTimePages);
  }

  const roots = overviewPageId
    ? pages.filter((page) => page.id === overviewPageId)
    : childrenByParent.get(null) ?? [];
  const items: PageTreeItem[] = [];
  const visited = new Set<number>();

  const visit = (page: TimePage, depth: number) => {
    if (visited.has(page.id)) return;
    visited.add(page.id);
    items.push({ page, depth });

    for (const child of childrenByParent.get(page.id) ?? []) {
      visit(child, depth + 1);
    }
  };

  for (const page of roots) {
    visit(page, 0);
  }

  for (const page of [...pages].sort(compareTimePages)) {
    if (!visited.has(page.id)) {
      visit(page, 0);
    }
  }

  return items;
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
  collapsed?: boolean;
  onClick: () => void;
}

function PageTreeButton({
  page,
  active,
  depth,
  collapsed = false,
  onClick,
}: PageTreeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? `${page.title} · ${formatPageType(page.type)}` : undefined}
      className={cn(
        "w-full flex items-center gap-2 rounded-xl text-left text-sm transition-colors",
        collapsed ? "justify-start px-2 py-2 text-xs" : "px-3 py-2",
        active
          ? "bg-sahara-primary-light text-sahara-primary font-bold"
          : "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
      )}
      style={collapsed ? undefined : { paddingLeft: `${12 + depth * 18}px` }}
    >
      {!collapsed && (
        page.type === "overview" ? (
          <FolderTree className="size-4 shrink-0" />
        ) : page.type === "day" ? (
          <FileText className="size-4 shrink-0" />
        ) : (
          <CalendarDays className="size-4 shrink-0" />
        )
      )}
      <span className="min-w-0 flex-1 truncate">{page.title}</span>
      {!collapsed && (
        <span className="text-[10px] text-sahara-text-muted shrink-0">
          {formatPageType(page.type)}
        </span>
      )}
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
          {done && task.completion_review && (
            <div className="mt-3 max-h-24 overflow-hidden rounded-xl border border-sahara-border/10 bg-sahara-card/45 px-3 py-2">
              <MarkdownRenderer
                content={task.completion_review}
                variant="compact"
                className="text-xs md:text-sm"
              />
            </div>
          )}
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
          placeholder="新增一个周计划条目，例如：Time-butler 记录系统"
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
    <section className="flex h-[calc(100vh-14rem)] min-h-[30rem] flex-1 flex-col overflow-hidden rounded-2xl bg-sahara-surface">
      <div className="shrink-0 px-5 pt-5 md:px-8 md:pt-7">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 truncate text-2xl font-bold text-sahara-text md:text-3xl">
            {activePage.title}
          </h2>
          <div className="mt-2 flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sahara-text-muted">
            <Save className="size-3.5" />
            <span>{saveLabel}</span>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sahara-text-muted">
              <Loader2 className="size-5 animate-spin" />
            </div>
          }
        >
          <DocumentNoteEditor
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
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const setActiveTask = useTimerStore((state) => state.setActiveTask);

  const [draftPageId, setDraftPageId] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPageTreeCollapsed, setIsPageTreeCollapsed] = useState(false);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? null,
    [activePageId, pages],
  );

  const pageTree = useMemo(() => {
    return buildPageTree(pages, overviewPageId);
  }, [overviewPageId, pages]);

  const currentDayTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !isTaskDone(task) &&
          dateKeyFromValue(task.scheduled_for) === workspaceKeys.day,
      ),
    [tasks, workspaceKeys.day],
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
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
            记录
          </p>
          <h1 className="mt-1 truncate text-base font-bold text-sahara-text md:text-lg">
            时间计划工作台
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
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

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-5",
          isPageTreeCollapsed
            ? "lg:grid-cols-[10rem_minmax(0,1fr)]"
            : "lg:grid-cols-[20rem_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "min-h-64 rounded-3xl border border-sahara-border/20 bg-sahara-surface shadow-sm shadow-sahara-primary/5 transition-all lg:min-h-0",
            isPageTreeCollapsed ? "p-2" : "p-3",
          )}
        >
          <div
            className={cn(
              "mb-3 flex items-center gap-2 pt-2",
              isPageTreeCollapsed ? "justify-center px-0" : "px-2",
            )}
          >
            {!isPageTreeCollapsed && (
              <>
                <FolderTree className="size-4 text-sahara-primary" />
                <h2 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.2em] text-sahara-text-muted">
                  页面树
                </h2>
              </>
            )}
            <Button
              variant="ghost"
              intent="default"
              size="icon-sm"
              shape="rounded-full"
              onClick={() => setIsPageTreeCollapsed((collapsed) => !collapsed)}
              title={isPageTreeCollapsed ? "展开页面树" : "收起页面树"}
              aria-label={isPageTreeCollapsed ? "展开页面树" : "收起页面树"}
              className={cn(!isPageTreeCollapsed && "ml-auto")}
            >
              {isPageTreeCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          </div>
          <div className="space-y-1">
            {pageTree.map(({ page, depth }) => (
              <PageTreeButton
                key={page.id}
                page={page}
                active={page.id === activePage.id}
                depth={depth}
                collapsed={isPageTreeCollapsed}
                onClick={() => void handleSelectPage(page.id)}
              />
            ))}
          </div>

          {!isPageTreeCollapsed && (
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
          )}
        </aside>

        <main className="flex min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
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
