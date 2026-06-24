import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TASK_CATEGORIES,
  TASK_CATEGORY_NAMES,
  seedDefaultTaskCategories,
} from "@/lib/db/default-categories";

describe("default task categories", () => {
  it("keeps canonical category labels in the data layer", () => {
    const names = DEFAULT_TASK_CATEGORIES.map((category) => category.name);

    expect(names).toContain(TASK_CATEGORY_NAMES.codeChange);
    expect(names).toContain(TASK_CATEGORY_NAMES.materialOrganization);
    expect(names).toContain(TASK_CATEGORY_NAMES.communication);
    expect(names).not.toContain("工作");
    expect(names).not.toContain("投资");
    expect(names).not.toContain("个人事务");
  });

  it("seeds categories idempotently", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);

    await seedDefaultTaskCategories({ execute });

    expect(execute).toHaveBeenCalledTimes(DEFAULT_TASK_CATEGORIES.length);
    expect(execute).toHaveBeenCalledWith(
      "INSERT OR IGNORE INTO categories (name, color) VALUES ($1, $2)",
      [
        DEFAULT_TASK_CATEGORIES[0].name,
        DEFAULT_TASK_CATEGORIES[0].color,
      ],
    );
  });
});
