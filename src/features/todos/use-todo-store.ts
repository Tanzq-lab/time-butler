import { create } from "zustand";
import type { Todo } from "@/lib/db";
import {
  addTodo as dbAddTodo,
  archiveTodo as dbArchiveTodo,
  getTodos,
  recordAppEvent,
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
  setCompleted: (id: number, completed: boolean) => Promise<boolean>;
  archiveTodo: (id: number, eventName?: TodoArchiveEvent) => Promise<boolean>;
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const aDone = Boolean(a.completed_at);
    const bDone = Boolean(b.completed_at);
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aTime = new Date(a.completed_at ?? a.created_at).getTime();
    const bTime = new Date(b.completed_at ?? b.created_at).getTime();
    return bTime - aTime;
  });
}

export const useTodoStore = create<TodoStore>((set) => ({
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
