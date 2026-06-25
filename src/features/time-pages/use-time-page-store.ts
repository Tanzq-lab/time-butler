import { create } from "zustand";
import type { TimePage, WeekPlanItem } from "@/lib/db";
import {
  addWeekPlanItem as dbAddWeekPlanItem,
  archiveWeekPlanItem as dbArchiveWeekPlanItem,
  ensureTimeWorkspace,
  getWeekPlanItems,
  updateTimePageContent as dbUpdateTimePageContent,
  updateWeekPlanItemTitle as dbUpdateWeekPlanItemTitle,
} from "@/lib/db";
import { getWorkspaceKeys, type TimeWorkspaceKeys } from "@/lib/time-pages";

interface TimePageStore {
  pages: TimePage[];
  weekPlanItems: WeekPlanItem[];
  activePageId: number | null;
  workspaceKeys: TimeWorkspaceKeys;
  overviewPageId: number | null;
  yearPageId: number | null;
  monthPageId: number | null;
  weekPageId: number | null;
  dayPageId: number | null;
  loading: boolean;
  error: string | null;
  loadWorkspace: (date?: Date) => Promise<void>;
  selectPage: (id: number) => void;
  updatePageContent: (id: number, content: string) => Promise<void>;
  addWeekPlanItem: (title: string) => Promise<void>;
  updateWeekPlanItemTitle: (id: number, title: string) => Promise<void>;
  archiveWeekPlanItem: (id: number) => Promise<void>;
}

export const useTimePageStore = create<TimePageStore>((set, get) => ({
  pages: [],
  weekPlanItems: [],
  activePageId: null,
  workspaceKeys: getWorkspaceKeys(),
  overviewPageId: null,
  yearPageId: null,
  monthPageId: null,
  weekPageId: null,
  dayPageId: null,
  loading: false,
  error: null,

  loadWorkspace: async (date = new Date()) => {
    set({ loading: true, error: null });
    try {
      const workspace = await ensureTimeWorkspace(date);
      const weekPlanItems = await getWeekPlanItems(workspace.weekPageId);
      const activePageStillExists = workspace.pages.some(
        (page) => page.id === get().activePageId,
      );
      set({
        pages: workspace.pages,
        weekPlanItems,
        activePageId: activePageStillExists
          ? get().activePageId
          : workspace.overviewPageId,
        workspaceKeys: getWorkspaceKeys(date),
        overviewPageId: workspace.overviewPageId,
        yearPageId: workspace.yearPageId,
        monthPageId: workspace.monthPageId,
        weekPageId: workspace.weekPageId,
        dayPageId: workspace.dayPageId,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("[TimePageStore] Failed to load workspace:", err);
      set({ loading: false, error: String(err) });
    }
  },

  selectPage: (id) => set({ activePageId: id }),

  updatePageContent: async (id, content) => {
    try {
      await dbUpdateTimePageContent(id, content);
      const updatedAt = new Date().toISOString();
      set((state) => ({
        pages: state.pages.map((page) =>
          page.id === id ? { ...page, content, updated_at: updatedAt } : page,
        ),
        error: null,
      }));
    } catch (err) {
      console.error("[TimePageStore] Failed to update page content:", err);
      set({ error: String(err) });
    }
  },

  addWeekPlanItem: async (title) => {
    const weekPageId = get().weekPageId;
    const trimmed = title.trim();
    if (!weekPageId || !trimmed) return;
    try {
      const id = await dbAddWeekPlanItem(weekPageId, trimmed);
      const now = new Date().toISOString();
      const item: WeekPlanItem = {
        id,
        week_page_id: weekPageId,
        title: trimmed,
        sort_order: get().weekPlanItems.length,
        archived: 0,
        created_at: now,
        updated_at: now,
      };
      set((state) => ({
        weekPlanItems: [...state.weekPlanItems, item],
        error: null,
      }));
    } catch (err) {
      console.error("[TimePageStore] Failed to add week plan item:", err);
      set({ error: String(err) });
    }
  },

  updateWeekPlanItemTitle: async (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await dbUpdateWeekPlanItemTitle(id, trimmed);
      const updatedAt = new Date().toISOString();
      set((state) => ({
        weekPlanItems: state.weekPlanItems.map((item) =>
          item.id === id ? { ...item, title: trimmed, updated_at: updatedAt } : item,
        ),
        error: null,
      }));
    } catch (err) {
      console.error("[TimePageStore] Failed to update week plan item:", err);
      set({ error: String(err) });
    }
  },

  archiveWeekPlanItem: async (id) => {
    try {
      await dbArchiveWeekPlanItem(id);
      set((state) => ({
        weekPlanItems: state.weekPlanItems.filter((item) => item.id !== id),
        error: null,
      }));
    } catch (err) {
      console.error("[TimePageStore] Failed to archive week plan item:", err);
      set({ error: String(err) });
    }
  },
}));
