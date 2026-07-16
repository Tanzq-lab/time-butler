import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
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

type TodoDropPosition = "before" | "after";

interface TodoDropTarget {
  id: number;
  position: TodoDropPosition;
}

interface PointerDrag {
  todoId: number;
  pointerId: number;
  startY: number;
  isDragging: boolean;
  latestOffsetY: number;
  frameId: number | null;
  rowElement: HTMLDivElement;
  rowBounds: TodoRowBounds[];
}

interface TodoRowBounds {
  id: number;
  top: number;
  bottom: number;
  midpoint: number;
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
  dropIndicator: TodoDropPosition | null;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
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
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TodoRowProps) {
  const completed = Boolean(todo.completed_at);

  return (
    <div
      data-todo-id={todo.id}
      onPointerDown={reorderable ? onPointerDown : undefined}
      onPointerMove={reorderable ? onPointerMove : undefined}
      onPointerUp={reorderable ? onPointerUp : undefined}
      onPointerCancel={reorderable ? onPointerCancel : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 border-b border-sahara-border/75 px-1 py-2.5 last:border-b-0 transition-[background-color,box-shadow,opacity,transform] duration-150 motion-reduce:transition-none",
        reorderable && "cursor-grab select-none hover:bg-sahara-card/35",
        dragging && "cursor-grabbing rounded-lg bg-sahara-surface shadow-lg ring-1 ring-sahara-primary/25",
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
            <span
              aria-hidden="true"
              title="按住待办空白处拖动调整顺序"
              className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-sahara-text-muted/80"
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </span>
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
  const [dropTarget, setDropTarget] = useState<TodoDropTarget | null>(null);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const dropTargetRef = useRef<TodoDropTarget | null>(null);

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

  const setCurrentDropTarget = (target: TodoDropTarget | null) => {
    if (
      dropTargetRef.current?.id === target?.id
      && dropTargetRef.current?.position === target?.position
    ) {
      return;
    }
    dropTargetRef.current = target;
    setDropTarget(target);
  };

  const applyPointerTransform = (pointerDrag: PointerDrag) => {
    pointerDrag.rowElement.style.transform =
      `translate3d(0, ${pointerDrag.latestOffsetY}px, 0) scale(1.01)`;
  };

  const releasePointerDrag = (pointerDrag: PointerDrag) => {
    if (pointerDrag.frameId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(pointerDrag.frameId);
    }
    pointerDrag.frameId = null;
    pointerDrag.rowElement.style.removeProperty("transform");
    pointerDrag.rowElement.style.removeProperty("transition");
    pointerDrag.rowElement.style.removeProperty("will-change");
    pointerDrag.rowElement.style.removeProperty("pointer-events");
  };

  const clearPointerDrag = () => {
    const pointerDrag = pointerDragRef.current;
    if (pointerDrag) releasePointerDrag(pointerDrag);
    pointerDragRef.current = null;
    setDraggingTodoId(null);
    setCurrentDropTarget(null);
  };

  const isTodoControl = (target: EventTarget | null) =>
    target instanceof Element
    && Boolean(target.closest("button, input, textarea, select, a, [data-todo-drag-exempt]"));

  const captureTodoRowBounds = (): TodoRowBounds[] => {
    const openTodoIds = new Set(openTodos.map((todo) => todo.id));
    return Array.from(document.querySelectorAll<HTMLElement>("[data-todo-id]"))
      .map((row) => {
        const id = Number(row.dataset.todoId);
        const bounds = row.getBoundingClientRect();
        return {
          id,
          top: bounds.top,
          bottom: bounds.bottom,
          midpoint: bounds.top + bounds.height / 2,
        };
      })
      .filter((row) => Number.isInteger(row.id) && openTodoIds.has(row.id));
  };

  const getDropTargetAtY = (
    clientY: number,
    pointerDrag: PointerDrag,
  ): TodoDropTarget | null => {
    const row = pointerDrag.rowBounds.find(
      (bounds) =>
        bounds.id !== pointerDrag.todoId
        && clientY >= bounds.top
        && clientY <= bounds.bottom,
    );
    if (!row) return null;

    return {
      id: row.id,
      position: clientY < row.midpoint ? "before" : "after",
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, todoId: number) => {
    if (event.button !== 0 || event.isPrimary === false || isTodoControl(event.target)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDragRef.current = {
      todoId,
      pointerId: event.pointerId,
      startY: event.clientY,
      isDragging: false,
      latestOffsetY: 0,
      frameId: null,
      rowElement: event.currentTarget,
      rowBounds: [],
    };
    setCurrentDropTarget(null);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    const offsetY = event.clientY - pointerDrag.startY;
    if (!pointerDrag.isDragging && Math.abs(offsetY) < 6) return;

    event.preventDefault();
    if (!pointerDrag.isDragging) {
      pointerDrag.isDragging = true;
      pointerDrag.rowBounds = captureTodoRowBounds();
      pointerDrag.rowElement.style.transition = "none";
      pointerDrag.rowElement.style.willChange = "transform";
      pointerDrag.rowElement.style.pointerEvents = "none";
      setDraggingTodoId(pointerDrag.todoId);
    }

    pointerDrag.latestOffsetY = offsetY;
    if (pointerDrag.frameId === null) {
      if (typeof requestAnimationFrame === "function") {
        pointerDrag.frameId = requestAnimationFrame(() => {
          if (pointerDragRef.current !== pointerDrag) return;
          pointerDrag.frameId = null;
          applyPointerTransform(pointerDrag);
        });
      } else {
        applyPointerTransform(pointerDrag);
      }
    }
    setCurrentDropTarget(getDropTargetAtY(event.clientY, pointerDrag));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    const target = dropTargetRef.current;
    releasePointerDrag(pointerDrag);
    pointerDragRef.current = null;
    setDraggingTodoId(null);
    setCurrentDropTarget(null);
    if (!pointerDrag.isDragging || !target) return;

    const draggedTodoId = pointerDrag.todoId;
    if (draggedTodoId === target.id) return;

    const orderedIds = openTodos.map((todo) => todo.id);
    const sourceIndex = orderedIds.indexOf(draggedTodoId);
    const targetIndex = orderedIds.indexOf(target.id);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextIds = [...orderedIds];
    nextIds.splice(sourceIndex, 1);
    const insertIndex = nextIds.indexOf(target.id) + (target.position === "after" ? 1 : 0);
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
      onPointerDown={(event) => handlePointerDown(event, todo.id)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearPointerDrag}
    />
  );

  return (
    <section
      aria-label="待办"
      aria-describedby={canReorder ? "todo-reorder-help" : undefined}
      className="mb-10"
    >
      <SectionHeader
        title="待办"
        meta={<span className="text-xs text-sahara-text-muted">{openTodos.length}</span>}
        className="mb-3"
      />

      {canReorder && (
        <p id="todo-reorder-help" className="sr-only">
          按住待办文字或右侧点阵，拖到另一条待办的上方或下方以调整顺序。
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
