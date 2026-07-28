import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTimePageContent } from "@/lib/db/time-pages";
import { getDb } from "@/lib/db/schema";

vi.mock("@/lib/db/schema", () => ({ getDb: vi.fn() }));

const execute = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ execute } as never);
});

describe("time page database boundaries", () => {
  it("updates only when the persisted content is different", async () => {
    execute.mockResolvedValue({ rowsAffected: 1 });

    await expect(updateTimePageContent(43, "新的内容")).resolves.toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("AND content <> $1"),
      ["新的内容", 43],
    );
  });

  it("reports an exact duplicate as unchanged", async () => {
    execute.mockResolvedValue({ rowsAffected: 0 });

    await expect(updateTimePageContent(43, "相同内容")).resolves.toBe(false);
  });
});
