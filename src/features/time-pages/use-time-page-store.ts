import { create } from "zustand";
import type { TimePage } from "@/lib/db";
import {
  ensureTimeWorkspace,
  recordAppEvent,
  updateTimePageContent as dbUpdateTimePageContent,
} from "@/lib/db";
import { getWorkspaceKeys, type TimeWorkspaceKeys } from "@/lib/time-pages";

interface TimePageStore {
  pages: TimePage[];
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
}

function measureTextChange(previous: string, next: string) {
  let sharedPrefixLength = 0;
  const maxPrefixLength = Math.min(previous.length, next.length);
  while (
    sharedPrefixLength < maxPrefixLength
    && previous[sharedPrefixLength] === next[sharedPrefixLength]
  ) {
    sharedPrefixLength += 1;
  }

  let sharedSuffixLength = 0;
  const maxSuffixLength = Math.min(
    previous.length - sharedPrefixLength,
    next.length - sharedPrefixLength,
  );
  while (
    sharedSuffixLength < maxSuffixLength
    && previous[previous.length - 1 - sharedSuffixLength]
      === next[next.length - 1 - sharedSuffixLength]
  ) {
    sharedSuffixLength += 1;
  }

  const removedCharacters =
    previous.length - sharedPrefixLength - sharedSuffixLength;
  const insertedCharacters =
    next.length - sharedPrefixLength - sharedSuffixLength;

  return {
    removedCharacters,
    insertedCharacters,
    changedCharacters: removedCharacters + insertedCharacters,
  };
}

export const useTimePageStore = create<TimePageStore>((set, get) => ({
  pages: [],
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
      const activePageStillExists = workspace.pages.some(
        (page) => page.id === get().activePageId,
      );
      set({
        pages: workspace.pages,
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

  selectPage: (id) => {
    const page = get().pages.find((item) => item.id === id);
    set({ activePageId: id });
    void recordAppEvent({
      eventName: "time_page_selected",
      route: "/notes",
      entityType: "time_page",
      entityId: id,
      metadata: {
        pageType: page?.type ?? null,
        dateKey: page?.date_key ?? null,
      },
    });
  },

  updatePageContent: async (id, content) => {
    try {
      const previousPage = get().pages.find((page) => page.id === id);
      if (!previousPage || previousPage.content === content) return;

      const textChange = measureTextChange(previousPage.content, content);
      const contentChanged = await dbUpdateTimePageContent(id, content);
      const updatedAt = new Date().toISOString();
      set((state) => ({
        pages: state.pages.map((page) =>
          page.id === id
            ? {
                ...page,
                content,
                updated_at: contentChanged ? updatedAt : page.updated_at,
              }
            : page,
        ),
        error: null,
      }));
      if (!contentChanged) return;

      void recordAppEvent({
        eventName: "time_page_content_updated",
        route: "/notes",
        entityType: "time_page",
        entityId: id,
        metadata: {
          pageType: previousPage?.type ?? null,
          dateKey: previousPage?.date_key ?? null,
          previousLength: previousPage?.content.length ?? null,
          nextLength: content.length,
          deltaLength: previousPage ? content.length - previousPage.content.length : null,
          ...textChange,
        },
      });
    } catch (err) {
      console.error("[TimePageStore] Failed to update page content:", err);
      set({ error: String(err) });
    }
  },
}));
