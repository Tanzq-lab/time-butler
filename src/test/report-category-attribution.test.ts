import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAllCategoryBreakdown,
  getCategoryBreakdown,
} from "@/lib/db/analytics";
import { getTodaySessions, getWeekSessions } from "@/lib/db/sessions";
import { getDb } from "@/lib/db/schema";

vi.mock("@/lib/db/schema", () => ({
  getDb: vi.fn(),
}));

const select = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ select } as never);
  select.mockResolvedValue([]);
});

describe("report category attribution", () => {
  it("groups focus subtasks by their parent task title", async () => {
    await getCategoryBreakdown("2026-07-01", "2026-07-31");

    const [query, parameters] = select.mock.calls[0];
    expect(query).toContain(
      "LEFT JOIN tasks parent_task ON task.parent_id = parent_task.id",
    );
    expect(query).toContain(
      "WHEN parent_task.id IS NOT NULL THEN parent_task.name",
    );
    expect(query).toContain(
      "GROUP BY category_id, intention, category_name, category_color",
    );
    expect(parameters).toEqual(["2026-07-01", "2026-07-31"]);
  });

  it("keeps the same attribution rule for today and all-time breakdowns", async () => {
    await getCategoryBreakdown();
    await getAllCategoryBreakdown();

    const todayQuery = select.mock.calls[0][0] as string;
    const allTimeQuery = select.mock.calls[1][0] as string;

    expect(todayQuery).toContain(
      "date(started_at) = date('now', 'localtime')",
    );
    expect(allTimeQuery).not.toContain("date(started_at)");
    for (const query of [todayQuery, allTimeQuery]) {
      expect(query).toContain(
        "WHEN parent_task.id IS NOT NULL THEN parent_task.name",
      );
    }
  });

  it("returns parent titles on session feeds used by focus and calendar views", async () => {
    await getTodaySessions();
    await getWeekSessions("2026-07-27", "2026-08-02");

    for (const [query] of select.mock.calls) {
      expect(query).toContain(
        "LEFT JOIN tasks parent_task ON t.parent_id = parent_task.id",
      );
      expect(query).toContain(
        "WHEN parent_task.id IS NOT NULL THEN parent_task.name",
      );
    }
  });
});
