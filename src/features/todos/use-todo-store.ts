import { create } from "zustand";
import type { Todo } from "@/lib/db";
import {
  addTodo as dbAddTodo,
  archiveTodo as dbArchiveTodo,
  getTodos,
  recordAppEvent,
  reorderTodos as dbReorderTodos,
  setTodoCompleted as dbSetTodoCompleted,
  updateTodoTitle as dbUpdateTodoTitle,
} from "@/lib/db";

type TodoArchiveEvent = "todo_archived" | "todo_converted_to_task";

interface TodoStore {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  loadTodos: () => Promise<void>;
  addTodo: (title: string) => Promise<Todo | null>;
  updateTodo: (id: number, title: string) => Promise<boolean>;
  reorderOpenTodos: (orderedIds: number[]) => Promise<boolean>;
  setCompleted: (id: number, completed: boolean) => Promise<boolean>;
  archiveTodo: (id: number, eventName?: TodoArchiveEvent) => Promise<boolean>;
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const aDone = Boolean(a.completed_at);
    const bDone = Boolean(b.completed_at);
    if (aDone !== bDone) return aDone ? 1 : -1;

    if (!aDone) {
      const sortOrder = a.sort_order - b.sort_order;
      if (sortOrder !== 0) return sortOrder;
    }

    const aTime = new Date(a.completed_at ?? a.created_at).getTime();
    const bTime = new Date(b.completed_at ?? b.created_at).getTime();
    return bTime - aTime;
  });
}

function getLastOpenTodoSortOrder(todos: Todo[]): number {
  const openSortOrders = todos
    .filter((todo) => !todo.completed_at)
    .map((todo) => todo.sort_order);
  return Math.max(-1, ...openSortOrders) + 1;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  loading: false,
  error: null,

  loadTodos: async () => {
    set({ loading: true, error: null });
    try {
      const todos = await getTodos();
      set({ todos: sortTodos(todos), loading: false });
    } catch (err) {
      console.error("[TodoStore] Failed to load todos:", err);
      set({ loading: false, error: String(err) });
    }
  },

  addTodo: async (title) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return null;

    try {
      const now = new Date().toISOString();
      const id = await dbAddTodo(cleanTitle, now);
      const todo: Todo = {
        id,
        title: cleanTitle,
        sort_order: getLastOpenTodoSortOrder(get().todos),
        completed_at: null,
        archived: 0,
        created_at: now,
        updated_at: now,
      };
      set((state) => ({
        todos: sortTodos([todo, ...state.todos]),
        error: null,
      }));
      void recordAppEvent({
        eventName: "todo_added",
        route: "/tasks",
        entityType: "todo",
        entityId: id,
      });
      return todo;
    } catch (err) {
      console.error("[TodoStore] Failed to add todo:", err);
      set({ error: String(err) });
      return null;
    }
  },

  updateTodo: async (id, title) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return false;

    try {
      const updatedAt = new Date().toISOString();
      await dbUpdateTodoTitle(id, cleanTitle, updatedAt);
      set((state) => ({
        todos: state.todos.map((todo) =>
          todo.id === id
            ? { ...todo, title: cleanTitle, updated_at: updatedAt }
            : todo,
        ),
        error: null,
      }));
      void recordAppEvent({
        eventName: "todo_updated",
        route: "/tasks",
        entityType: "todo",
        entityId: id,
      });
      return true;
    } catch (err) {
      console.error("[TodoStore] Failed to update todo:", err);
      set({ error: String(err) });
      return false;
    }
  },

  reorderOpenTodos: async (orderedIds) => {
    const openTodos = sortTodos(get().todos).filter((todo) => !todo.completed_at);
    const openTodoIds = openTodos.map((todo) => todo.id);
    const idsMatchOpenTodos =
      orderedIds.length === openTodoIds.length
      && new Set(orderedIds).size === orderedIds.length
      && orderedIds.every((id) => openTodoIds.includes(id));

    if (!idsMatchOpenTodos) return false;
    if (orderedIds.every((id, index) => id === openTodoIds[index])) return true;

    try {
      const updatedAt = new Date().toISOString();
      await dbReorderTodos(orderedIds, updatedAt);
      const sortOrderById = new Map(orderedIds.map((id, index) => [id, index]));
      set((state) => ({
        todos: sortTodos(
          state.todos.map((todo) => {
            const sortOrder = sortOrderById.get(todo.id);
            return sortOrder === undefined
              ? todo
              : { ...todo, sort_order: sortOrder, updated_at: updatedAt };
          }),
        ),
        error: null,
      }));
      void recordAppEvent({
        eventName: "todo_reordered",
        route: "/tasks",
        entityType: "todo_list",
        metadata: { count: orderedIds.length },
      });
      return true;
    } catch (err) {
      console.error("[TodoStore] Failed to reorder todos:", err);
      set({ error: String(err) });
      return false;
    }
  },

  setCompleted: async (id, completed) => {
    try {
      const updatedAt = new Date().toISOString();
      const completedAt = completed ? updatedAt : null;
      await dbSetTodoCompleted(id, completedAt, updatedAt);
      set((state) => ({
        todos: sortTodos(
          state.todos.map((todo) =>
            todo.id === id
              ? { ...todo, completed_at: completedAt, updated_at: updatedAt }
              : todo,
          ),
        ),
        error: null,
      }));
      void recordAppEvent({
        eventName: completed ? "todo_completed" : "todo_reopened",
        route: "/tasks",
        entityType: "todo",
        entityId: id,
      });
      return true;
    } catch (err) {
      console.error("[TodoStore] Failed to update completion:", err);
      set({ error: String(err) });
      return false;
    }
  },

  archiveTodo: async (id, eventName = "todo_archived") => {
    try {
      await dbArchiveTodo(id, new Date().toISOString());
      set((state) => ({
        todos: state.todos.filter((todo) => todo.id !== id),
        error: null,
      }));
      void recordAppEvent({
        eventName,
        route: "/tasks",
        entityType: "todo",
        entityId: id,
      });
      return true;
    } catch (err) {
      console.error("[TodoStore] Failed to archive todo:", err);
      set({ error: String(err) });
      return false;
    }
  },
}));
