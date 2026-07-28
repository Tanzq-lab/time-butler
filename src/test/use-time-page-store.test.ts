import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimePageStore } from "@/features/time-pages/use-time-page-store";

const dbMocks = vi.hoisted(() => ({
  updateTimePageContent: vi.fn(),
  recordAppEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ensureTimeWorkspace: vi.fn(),
  updateTimePageContent: dbMocks.updateTimePageContent,
  recordAppEvent: dbMocks.recordAppEvent,
}));

const storedPage = {
  id: 43,
  type: "day" as const,
  title: "2026-07-27 星期一",
  date_key: "2026-07-27",
  parent_id: 42,
  content: "原文",
  created_at: "2026-07-27 09:00:00",
  updated_at: "2026-07-27 09:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.updateTimePageContent.mockResolvedValue(true);
  dbMocks.recordAppEvent.mockResolvedValue(undefined);
  useTimePageStore.setState({
    pages: [storedPage],
    activePageId: storedPage.id,
    loading: false,
    error: null,
  });
});

describe("useTimePageStore content updates", () => {
  it("skips an exact duplicate before writing or recording an event", async () => {
    await useTimePageStore
      .getState()
      .updatePageContent(storedPage.id, storedPage.content);

    expect(dbMocks.updateTimePageContent).not.toHaveBeenCalled();
    expect(dbMocks.recordAppEvent).not.toHaveBeenCalled();
  });

  it("records the real edit size without storing page content", async () => {
    await useTimePageStore
      .getState()
      .updatePageContent(storedPage.id, "原稿");

    expect(dbMocks.updateTimePageContent).toHaveBeenCalledWith(
      storedPage.id,
      "原稿",
    );
    expect(dbMocks.recordAppEvent).toHaveBeenCalledWith({
      eventName: "time_page_content_updated",
      route: "/notes",
      entityType: "time_page",
      entityId: storedPage.id,
      metadata: {
        pageType: "day",
        dateKey: "2026-07-27",
        previousLength: 2,
        nextLength: 2,
        deltaLength: 0,
        removedCharacters: 1,
        insertedCharacters: 1,
        changedCharacters: 2,
      },
    });
    expect(
      JSON.stringify(dbMocks.recordAppEvent.mock.calls[0][0]),
    ).not.toContain("原稿");
  });

  it("suppresses a duplicate event when the database already has the content", async () => {
    dbMocks.updateTimePageContent.mockResolvedValue(false);

    await useTimePageStore
      .getState()
      .updatePageContent(storedPage.id, "新内容");

    expect(useTimePageStore.getState().pages[0]).toMatchObject({
      content: "新内容",
      updated_at: storedPage.updated_at,
    });
    expect(dbMocks.recordAppEvent).not.toHaveBeenCalled();
  });
});
