import { useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Focus,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Todo } from "@/lib/db";
import { useTodoStore } from "@/features/todos/use-todo-store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { SectionHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";

interface TodoSectionProps {
  searchQuery: string;
  onConvert: (todo: Todo) => void;
}

interface TodoRowProps {
  todo: Todo;
  editing: boolean;
  editingTitle: string;
  onEditingTitleChange: (title: string) => void;
  onToggle: () => void;
  onBeginEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
  onOpenMobileMenu: () => void;
  reorderable: boolean;
  dragging: boolean;
  dropIndicator: "before" | "after" | null;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function TodoRow({
  todo,
  editing,
  editingTitle,
  onEditingTitleChange,
  onToggle,
  onBeginEdit,
  onCommitEdit,
  onCancelEdit,
  onConvert,
  onDelete,
  onOpenMobileMenu,
  reorderable,
  dragging,
  dropIndicator,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TodoRowProps) {
  const completed = Boolean(todo.completed_at);

  return (
    <div
      data-todo-id={todo.id}
      onDragOver={reorderable ? onDragOver : undefined}
      onDrop={reorderable ? onDrop : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 border-b border-sahara-border/75 px-1 py-2.5 last:border-b-0 transition-[background-color,opacity] duration-150",
        dragging && "opacity-45",
        dropIndicator && "bg-sahara-card/50",
      )}
    >
      {dropIndicator === "before" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-0 z-10 h-0.5 rounded-full bg-sahara-primary"
        />
      )}
      {dropIndicator === "after" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 bottom-0 z-10 h-0.5 rounded-full bg-sahara-primary"
        />
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={completed}
        aria-label={completed ? `恢复待办：${todo.title}` : `完成待办：${todo.title}`}
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[5px] border outline-none transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus active:scale-95 motion-reduce:transform-none",
          completed
            ? "border-sahara-primary bg-sahara-primary text-sahara-bg"
            : "border-sahara-text-muted/55 bg-sahara-surface text-transparent hover:border-sahara-text",
        )}
      >
        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={editingTitle}
            aria-label={`编辑待办：${todo.title}`}
            onChange={(event) => onEditingTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitEdit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelEdit();
              }
            }}
            className="h-8 w-full rounded-md border border-sahara-border bg-sahara-surface px-2.5 text-sm text-sahara-text outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
          />
        ) : (
          <p
            className={cn(
              "truncate text-sm leading-6 text-sahara-text",
              completed && "text-sahara-text-muted line-through decoration-sahara-text-muted/55",
            )}
            title={todo.title}
          >
            {todo.title}
          </p>
        )}
      </div>

      {editing ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onCommitEdit}
            disabled={!editingTitle.trim()}
            aria-label={`保存待办：${todo.title}`}
            title="保存"
            className="rounded-md p-1.5 text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus disabled:pointer-events-none disabled:opacity-40"
          >
            <Check aria-hidden="true" className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label={`取消编辑：${todo.title}`}
            title="取消"
            className="rounded-md p-1.5 text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          {reorderable && (
            <button
              type="button"
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              aria-label={`拖动排序：${todo.title}`}
              aria-describedby="todo-reorder-help"
              title="拖动调整顺序"
              className="flex shrink-0 touch-none cursor-grab items-center justify-center rounded-md p-1.5 text-sahara-text-muted outline-none transition-[background-color,color,opacity] duration-150 hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
          )}
          <div className="hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 md:flex md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button
              type="button"
              onClick={onBeginEdit}
              aria-label={`编辑待办：${todo.title}`}
              title="编辑"
              className="rounded-md p-1.5 text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onConvert}
              aria-label={`转为专注任务：${todo.title}`}
              title="转为专注任务"
              className="rounded-md p-1.5 text-sahara-text-muted outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
            >
              <Focus aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`删除待办：${todo.title}`}
              title="删除"
              className="rounded-md p-1.5 text-red-400 outline-none hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/30"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label={`更多待办操作：${todo.title}`}
            className="rounded-md p-1.5 text-sahara-text-secondary outline-none hover:bg-sahara-card focus-visible:ring-2 focus-visible:ring-sahara-focus md:hidden"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

export function TodoSection({ searchQuery, onConvert }: TodoSectionProps) {
  const todos = useTodoStore((state) => state.todos);
  const error = useTodoStore((state) => state.error);
  const loadTodos = useTodoStore((state) => state.loadTodos);
  const addTodo = useTodoStore((state) => state.addTodo);
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const reorderOpenTodos = useTodoStore((state) => state.reorderOpenTodos);
  const setCompleted = useTodoStore((state) => state.setCompleted);
  const archiveTodo = useTodoStore((state) => state.archiveTodo);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [mobileTodo, setMobileTodo] = useState<Todo | null>(null);
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: number;
    position: "before" | "after";
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    const refreshTodos = () => {
      if (!disposed) void loadTodos();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshTodos();
    };

    refreshTodos();
    window.addEventListener("focus", refreshTodos);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshTodos);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadTodos]);

  const filteredTodos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return todos;
    return todos.filter((todo) => todo.title.toLowerCase().includes(query));
  }, [searchQuery, todos]);

  const openTodos = filteredTodos.filter((todo) => !todo.completed_at);
  const completedTodos = filteredTodos.filter((todo) => todo.completed_at);
  const revealCompleted = Boolean(searchQuery.trim()) || showCompleted;
  const canReorder = !searchQuery.trim() && openTodos.length > 1;

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const created = await addTodo(draft);
    if (created) setDraft("");
  };

  const beginEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  };

  const commitEdit = async (todo: Todo) => {
    const updated = await updateTodo(todo.id, editingTitle);
    if (updated) {
      setEditingId(null);
      setEditingTitle("");
    }
  };

  const handleDelete = async () => {
    if (!todoToDelete) return;
    const archived = await archiveTodo(todoToDelete.id);
    if (archived) setTodoToDelete(null);
  };

  const getDropPosition = (event: DragEvent<HTMLDivElement>): "before" | "after" => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const clearDragState = () => {
    setDraggingTodoId(null);
    setDropTarget(null);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, todoId: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(todoId));
    setDraggingTodoId(todoId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, todoId: number) => {
    if (draggingTodoId === null || draggingTodoId === todoId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const position = getDropPosition(event);
    setDropTarget((current) =>
      current?.id === todoId && current.position === position ? current : { id: todoId, position },
    );
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetTodoId: number) => {
    event.preventDefault();
    const draggedTodoId = draggingTodoId
      ?? Number(event.dataTransfer.getData("text/plain"));
    const position = getDropPosition(event);
    clearDragState();

    if (!draggedTodoId || draggedTodoId === targetTodoId) return;

    const orderedIds = openTodos.map((todo) => todo.id);
    const sourceIndex = orderedIds.indexOf(draggedTodoId);
    const targetIndex = orderedIds.indexOf(targetTodoId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextIds = [...orderedIds];
    nextIds.splice(sourceIndex, 1);
    const insertIndex = nextIds.indexOf(targetTodoId) + (position === "after" ? 1 : 0);
    nextIds.splice(insertIndex, 0, draggedTodoId);
    void reorderOpenTodos(nextIds);
  };

  const renderRow = (todo: Todo) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      editing={editingId === todo.id}
      editingTitle={editingTitle}
      onEditingTitleChange={setEditingTitle}
      onToggle={() => void setCompleted(todo.id, !todo.completed_at)}
      onBeginEdit={() => beginEdit(todo)}
      onCommitEdit={() => void commitEdit(todo)}
      onCancelEdit={() => {
        setEditingId(null);
        setEditingTitle("");
      }}
      onConvert={() => onConvert(todo)}
      onDelete={() => setTodoToDelete(todo)}
      onOpenMobileMenu={() => setMobileTodo(todo)}
      reorderable={canReorder && editingId === null}
      dragging={draggingTodoId === todo.id}
      dropIndicator={dropTarget?.id === todo.id ? dropTarget.position : null}
      onDragStart={(event) => handleDragStart(event, todo.id)}
      onDragEnd={clearDragState}
      onDragOver={(event) => handleDragOver(event, todo.id)}
      onDrop={(event) => handleDrop(event, todo.id)}
    />
  );

  return (
    <section aria-label="待办" className="mb-10">
      <SectionHeader
        title="待办"
        meta={<span className="text-xs text-sahara-text-muted">{openTodos.length}</span>}
        className="mb-3"
      />

      {canReorder && (
        <p id="todo-reorder-help" className="sr-only">
          按住待办右侧的拖动手柄，拖到另一条待办的上方或下方以调整顺序。
        </p>
      )}

      {openTodos.length > 0 && <div>{openTodos.map(renderRow)}</div>}

      <form
        onSubmit={handleAdd}
        className="flex items-center gap-2 border-y border-sahara-border bg-sahara-surface py-2.5"
      >
        <Plus aria-hidden="true" className="ml-1 size-4 shrink-0 text-sahara-text-muted" />
        <input
          type="text"
          name="todo-title"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="添加待办"
          placeholder="添加待办，按回车保存…"
          className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted"
        />
        <Button
          type="submit"
          variant="ghost"
          intent="sahara"
          size="xs"
          disabled={!draft.trim()}
          className="mr-1"
        >
          添加
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          待办保存失败，请重试。
        </p>
      )}

      {filteredTodos.length === 0 && (
        <p className="border-b border-sahara-border px-1 py-5 text-sm text-sahara-text-muted">
          {searchQuery.trim()
            ? "没有匹配的待办。"
            : "把不需要开启番茄的小事放在这里。"}
        </p>
      )}

      {completedTodos.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCompleted((value) => !value)}
            aria-expanded={revealCompleted}
            className="flex w-full items-center gap-2 rounded-md py-1 text-left text-sahara-text-secondary outline-none hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
          >
            {revealCompleted ? (
              <ChevronDown aria-hidden="true" className="size-4 text-sahara-text-muted" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4 text-sahara-text-muted" />
            )}
            <span className="text-xs font-semibold">
              已完成待办（{completedTodos.length}）
            </span>
          </button>
          {revealCompleted && <div className="mt-1">{completedTodos.map(renderRow)}</div>}
        </div>
      )}

      <ModalOverlay
        open={Boolean(mobileTodo)}
        onClose={() => setMobileTodo(null)}
        placement="bottom"
        maxWidth="max-w-md"
        ariaLabel={mobileTodo ? `待办操作：${mobileTodo.title}` : "待办操作"}
        showCloseButton
      >
        {mobileTodo && (
          <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
            <p className="pr-10 text-sm font-semibold text-sahara-text">{mobileTodo.title}</p>
            <div className="mt-4 space-y-1">
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => {
                  beginEdit(mobileTodo);
                  setMobileTodo(null);
                }}
                className="justify-start gap-3 px-3 py-3"
              >
                <Pencil aria-hidden="true" className="size-4" />
                编辑待办
              </Button>
              <Button
                variant="ghost"
                intent="default"
                fullWidth
                onClick={() => {
                  onConvert(mobileTodo);
                  setMobileTodo(null);
                }}
                className="justify-start gap-3 px-3 py-3"
              >
                <Focus aria-hidden="true" className="size-4" />
                转为专注任务
              </Button>
              <Button
                variant="ghost"
                intent="red"
                fullWidth
                onClick={() => {
                  setTodoToDelete(mobileTodo);
                  setMobileTodo(null);
                }}
                className="justify-start gap-3 px-3 py-3"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                删除待办
              </Button>
            </div>
          </div>
        )}
      </ModalOverlay>

      <ConfirmDialog
        open={Boolean(todoToDelete)}
        title="删除待办？"
        description={todoToDelete ? `“${todoToDelete.title}”将从待办列表中移除。` : ""}
        confirmLabel="删除待办"
        destructive
        onClose={() => setTodoToDelete(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
