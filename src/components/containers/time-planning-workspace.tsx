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
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTaskModal, type AddTaskData } from "@/components/base/add-task-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { PageHeader } from "@/components/ui/page-header";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/cn";
import type { TimePage } from "@/lib/db";
import { addTaskActivityLog } from "@/lib/db";
import { getWeekDateRangeFromKey, toLocalISODate } from "@/lib/time-pages";
import { isTaskDone } from "@/features/tasks/task-completion";
import type { Task } from "@/features/tasks/task-types";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTimePageStore } from "@/features/time-pages/use-time-page-store";

const DocumentNoteEditor = lazy(() => import("./document-note-editor"));

type SaveState = "idle" | "saving" | "saved";

type PageTreeItem = {
  page: TimePage;
  depth: number;
};

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
        "flex w-full items-center gap-2 rounded-md text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
        collapsed ? "justify-start px-2 py-2 text-xs" : "px-3 py-1.5",
        active
          ? "bg-sahara-surface font-medium text-sahara-text"
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
        <span className="shrink-0 text-[10px] text-sahara-text-secondary">
          {formatPageType(page.type)}
        </span>
      )}
    </button>
  );
}

interface TaskCardProps {
  task: Task;
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
        "border-b border-sahara-border bg-sahara-surface px-1 py-4",
        done && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onComplete}
          disabled={done}
          aria-label={done ? `已完成：${task.name}` : `完成任务：${task.name}`}
          className="mt-1 cursor-pointer rounded-md text-sahara-text-muted outline-none hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus disabled:cursor-default disabled:text-green-600"
          title={done ? "已完成" : "完成任务"}
        >
          {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {task.project && (
              <span className="rounded-md bg-sahara-card px-2 py-0.5 text-[10px] font-medium text-sahara-text-muted">
                {task.project}
              </span>
            )}
          </div>
          <h4
            className={cn(
              "mt-2 text-base font-medium leading-snug text-sahara-text",
              done && "line-through text-sahara-text-muted",
            )}
          >
            {task.name}
          </h4>
          <div className="mt-2 flex items-center gap-3 text-xs text-sahara-text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              {task.completed_pomos}/{task.estimated_pomos} 个番茄
            </span>
            {task.scheduled_for && <span>{dateKeyFromValue(task.scheduled_for)}</span>}
          </div>
          {done && task.completion_review && (
            <div className="mt-3 max-h-24 overflow-hidden rounded-[10px] border border-sahara-border bg-sahara-card px-3 py-2">
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
            <Button variant="outline" intent="sahara" size="xs" onClick={onFocus}>
              专注
            </Button>
            <Button variant="outline" intent="default" size="xs" onClick={onMoveToday}>
              迁移到今天
            </Button>
            <Button variant="outline" intent="default" size="xs" onClick={onMoveTomorrow}>
              迁移到明天
            </Button>
            <Button variant="outline" intent="default" size="xs" onClick={onMoveCustomDate}>
              指定日期
            </Button>
          </>
        )}
        <Button variant="ghost" intent="default" size="xs" onClick={onEdit}>
          编辑
        </Button>
        <Button variant="ghost" intent="red" size="xs" onClick={onDelete}>
          删除
        </Button>
      </div>
    </div>
  );
}

interface PlanningTaskListProps {
  tasks: Task[];
  emptyLabel: string;
  onCompleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onFocusTask: (task: Task) => void;
  onMoveTask: (task: Task, dateKey: string) => void;
  onMoveTaskCustomDate: (task: Task) => void;
}

function PlanningTaskList({
  tasks,
  emptyLabel,
  onCompleteTask,
  onEditTask,
  onDeleteTask,
  onFocusTask,
  onMoveTask,
  onMoveTaskCustomDate,
}: PlanningTaskListProps) {
  const today = toLocalISODate(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalISODate(tomorrowDate);

  if (tasks.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-sahara-border p-8 text-center">
        <p className="text-sm text-sahara-text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
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
    <section className="flex h-[calc(100dvh-13rem)] min-h-[26rem] flex-1 flex-col overflow-hidden bg-sahara-surface lg:h-[calc(100vh-12rem)] lg:min-h-[30rem]">
      <div className="shrink-0 px-4 pt-4 md:px-8 md:pt-7">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-sahara-text md:text-3xl">
            {activePage.title}
          </h2>
          <div aria-live="polite" className="mt-2 flex shrink-0 items-center gap-1.5 text-xs text-sahara-text-secondary">
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

  const tasks = useTaskStore((state) => state.tasks);
  const loadTasks = useTaskStore((state) => state.loadTasks);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const setActiveTask = useTimerStore((state) => state.setActiveTask);

  const [draftPageId, setDraftPageId] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [loadedDraftContent, setLoadedDraftContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPageTreeCollapsed, setIsPageTreeCollapsed] = useState(false);
  const [pageTreeOpen, setPageTreeOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [taskToMove, setTaskToMove] = useState<Task | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveDateError, setMoveDateError] = useState("");

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? null,
    [activePageId, pages],
  );

  const hasUnsavedDraft =
    Boolean(activePage) &&
    draftPageId === activePage?.id &&
    draftContent !== loadedDraftContent;

  useEffect(() => {
    if (!hasUnsavedDraft) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedDraft]);

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

  useEffect(() => {
    void loadWorkspace();
    void loadTasks();
  }, [loadTasks, loadWorkspace]);

  const refreshWorkspace = useCallback(async () => {
    if (hasUnsavedDraft) return;
    await loadWorkspace();
  }, [hasUnsavedDraft, loadWorkspace]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshWorkspace();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshWorkspace();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!activePage) {
      setDraftPageId(null);
      setDraftContent("");
      setLoadedDraftContent("");
      setSaveState("idle");
      return;
    }
    if (draftPageId !== activePage.id) {
      setDraftPageId(activePage.id);
      setDraftContent(activePage.content);
      setLoadedDraftContent(activePage.content);
      setSaveState("saved");
      return;
    }
    if (draftContent === loadedDraftContent && activePage.content !== loadedDraftContent) {
      setDraftContent(activePage.content);
      setLoadedDraftContent(activePage.content);
      setSaveState("saved");
    }
  }, [activePage?.content, activePage?.id, draftContent, draftPageId, loadedDraftContent]);

  const persistDraft = useCallback(async () => {
    if (!activePage || draftPageId !== activePage.id) return;
    if (draftContent === loadedDraftContent) return;
    setSaveState("saving");
    await updatePageContent(activePage.id, draftContent);
    setLoadedDraftContent(draftContent);
    setSaveState("saved");
  }, [activePage, draftContent, draftPageId, loadedDraftContent, updatePageContent]);

  useEffect(() => {
    if (!activePage || draftPageId !== activePage.id) return;
    if (draftContent === loadedDraftContent) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activePage, draftContent, draftPageId, loadedDraftContent, persistDraft]);

  const handleSelectPage = async (pageId: number) => {
    await persistDraft();
    selectPage(pageId);
  };

  const handleCompleteTask = async (task: Task) => {
    const actualPomos = Math.max(task.completed_pomos, task.estimated_pomos, 1);
    await completeTask(task.id, actualPomos, "");
    await setActiveTask(null);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
  };

  const handleSubmitEditTask = async (data: AddTaskData) => {
    if (!taskToEdit) return;
    await updateTask(
      taskToEdit.id,
      data.name,
      data.estimatedPomos,
      undefined,
      undefined,
      undefined,
      taskToEdit.scheduled_for,
    );
    setTaskToEdit(null);
  };

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    await deleteTask(taskToDelete.id);
    setTaskToDelete(null);
  };

  const handleFocusTask = async (task: Task) => {
    await setActiveTask(task.id);
    navigate("/");
  };

  const handleMoveTask = async (task: Task, dateKey: string) => {
    const previousDate = task.scheduled_for ?? null;
    await updateTask(
      task.id,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dateKey,
    );
    await addTaskActivityLog(task.id, "moved_date", previousDate, dateKey);
  };

  const handleMoveTaskCustomDate = async (task: Task) => {
    setTaskToMove(task);
    setMoveDate(workspaceKeys.day);
    setMoveDateError("");
  };

  const confirmMoveTask = async () => {
    if (!taskToMove) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(moveDate)) {
      setMoveDateError("请选择有效日期");
      return;
    }
    await handleMoveTask(taskToMove, moveDate);
    setTaskToMove(null);
    setMoveDateError("");
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
    <>
      <AddTaskModal
        open={!!taskToEdit}
        onClose={() => setTaskToEdit(null)}
        onSubmit={handleSubmitEditTask}
        editTask={taskToEdit}
      />
      <ConfirmDialog
        open={!!taskToDelete}
        title="删除任务？"
        description={taskToDelete ? `“${taskToDelete.name}”将被永久删除。` : ""}
        confirmLabel="删除任务"
        destructive
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDeleteTask}
      />
      <ModalOverlay
        open={!!taskToMove}
        onClose={() => setTaskToMove(null)}
        maxWidth="max-w-sm"
        ariaLabel="指定迁移日期"
      >
        <div className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-sahara-text">迁移任务</h2>
          <p className="mt-1 text-sm text-sahara-text-secondary">
            {taskToMove ? `为“${taskToMove.name}”选择新的日期。` : "选择新的日期。"}
          </p>
          <label htmlFor="move-task-date" className="mt-5 block text-xs font-medium text-sahara-text-secondary">
            日期
          </label>
          <input
            id="move-task-date"
            type="date"
            name="move-task-date"
            value={moveDate}
            onChange={(event) => {
              setMoveDate(event.target.value);
              setMoveDateError("");
            }}
            className="mt-1.5 h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 font-mono text-sm text-sahara-text outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
          />
          {moveDateError && <p role="alert" className="mt-2 text-xs text-red-600">{moveDateError}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" intent="default" size="sm" onClick={() => setTaskToMove(null)}>取消</Button>
            <Button variant="solid" intent="sahara" size="sm" onClick={() => void confirmMoveTask()}>迁移</Button>
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={pageTreeOpen}
        onClose={() => setPageTreeOpen(false)}
        placement="bottom"
        maxWidth="max-w-lg"
        ariaLabel="选择记录页面"
        showCloseButton
      >
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
          <div className="pr-10">
            <h2 className="text-base font-semibold text-sahara-text">页面</h2>
            <p className="mt-1 text-xs text-sahara-text-secondary">
              {workspaceKeys.week} / {workspaceKeys.day}
            </p>
          </div>
          <div className="mt-4 max-h-[58dvh] space-y-1 overflow-y-auto overscroll-contain">
            {pageTree.map(({ page, depth }) => (
              <PageTreeButton
                key={page.id}
                page={page}
                active={page.id === activePage.id}
                depth={depth}
                onClick={() => {
                  void handleSelectPage(page.id).then(() => setPageTreeOpen(false));
                }}
              />
            ))}
          </div>
        </div>
      </ModalOverlay>

      <div className="flex min-h-[calc(100vh-8rem)] flex-col">
        <PageHeader
          eyebrow="记录"
          title="时间计划工作台"
          description="沿着年、月、周、日的链路记录，并把下一步直接带回任务。"
          className="mb-5"
          actions={<div className="flex flex-wrap gap-2 md:justify-end">
          {overviewPageId && (
            <Button variant="outline" intent="default" size="sm" onClick={() => void handleSelectPage(overviewPageId)}>
              总览
            </Button>
          )}
          <Button
            variant="outline"
            intent="default"
            size="icon-sm"
            onClick={() => void refreshWorkspace()}
            disabled={hasUnsavedDraft || loading}
            title={hasUnsavedDraft ? "有未保存内容，保存后再刷新" : "刷新页面内容"}
            aria-label={hasUnsavedDraft ? "有未保存内容，保存后再刷新" : "刷新页面内容"}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
          {dayPageId && (
            <Button variant="solid" intent="sahara" size="sm" onClick={() => void handleSelectPage(dayPageId)}>
              进入今天
            </Button>
          )}
          {weekPageId && (
            <Button variant="outline" intent="sahara" size="sm" onClick={() => void handleSelectPage(weekPageId)}>
              本周
            </Button>
          )}
          </div>}
        />

        <div className="mb-3 flex min-w-0 items-center gap-3 lg:hidden">
          <Button
            variant="outline"
            intent="default"
            size="sm"
            onClick={() => setPageTreeOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={pageTreeOpen}
          >
            <FolderTree className="size-4" />
            页面
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sahara-text">{activePage.title}</p>
            <p className="truncate font-mono text-[11px] text-sahara-text-secondary">
              {workspaceKeys.week} / {workspaceKeys.day}
            </p>
          </div>
        </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 overflow-hidden border border-sahara-border bg-sahara-surface",
          isPageTreeCollapsed
            ? "lg:grid-cols-[9rem_minmax(0,1fr)]"
            : "lg:grid-cols-[17rem_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "hidden min-h-0 border-r border-sahara-border bg-sahara-card transition-[width] duration-150 lg:block",
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
                <h2 className="min-w-0 flex-1 text-xs font-semibold text-sahara-text-secondary">
                  页面树
                </h2>
              </>
            )}
            <Button
              variant="ghost"
              intent="default"
              size="icon-sm"
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
            <div className="mt-5 border-t border-sahara-border px-3 pt-4">
              <p className="text-xs text-sahara-text-secondary">当前链路</p>
              <p className="mt-1 break-words font-mono text-[11px] leading-5 text-sahara-text-secondary">
                {workspaceKeys.year} / {workspaceKeys.month} / {workspaceKeys.week} / {workspaceKeys.day}
              </p>
            </div>
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-x-hidden bg-sahara-surface p-4 md:p-6">
          {activePage.type === "overview" && (
            <section className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => dayPageId && void handleSelectPage(dayPageId)}
                className="rounded-md border border-sahara-border bg-sahara-surface p-4 text-left outline-none transition-colors duration-150 hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus"
              >
                <p className="text-xs text-sahara-text-secondary">今天</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold text-sahara-text">今日任务</h3>
                  <p className="text-sm text-sahara-text-secondary">{currentDayTasks.length} 个待完成</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => weekPageId && void handleSelectPage(weekPageId)}
                className="rounded-md border border-sahara-border bg-sahara-surface p-4 text-left outline-none transition-colors duration-150 hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus"
              >
                <p className="text-xs text-sahara-text-secondary">本周</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold text-sahara-text">本周完成</h3>
                  <p className="text-sm text-green-600">{completedWeekTasks.length} 个已完成</p>
                </div>
              </button>
            </section>
          )}

          {activePage.type === "week" && (
            <>
              <MarkdownSection
                activePage={activePage}
                draftContent={draftContent}
                saveLabel={saveLabel}
                onChange={setDraftContent}
                onBlur={() => void persistDraft()}
              />
              <section className="border-t border-sahara-border p-5 md:p-6">
                <div className="mb-4">
                  <p className="text-xs text-sahara-text-muted">
                    本周完成
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-sahara-text">本周完成任务</h2>
                  <p className="mt-1 text-xs text-sahara-text-muted">
                    统计范围：{weekRange.start} 至 {weekRange.end}
                  </p>
                </div>
                <PlanningTaskList
                  tasks={completedWeekTasks}
                  emptyLabel="这周还没有完成任务。完成日任务后，会自动汇总到这里。"
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

          {activePage.type !== "week" && (
            <MarkdownSection
              activePage={activePage}
              draftContent={draftContent}
              saveLabel={saveLabel}
              onChange={setDraftContent}
              onBlur={() => void persistDraft()}
            />
          )}
        </div>
      </div>
      </div>
    </>
  );
}
