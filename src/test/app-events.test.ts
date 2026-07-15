import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/db/schema", () => ({
  getDb: vi.fn().mockResolvedValue({ execute }),
}));

import { recordAppEvent } from "@/lib/db/app-events";

describe("recordAppEvent", () => {
  beforeEach(() => {
    execute.mockClear();
  });

  it("adds local app-session context while retaining action metadata", async () => {
    await recordAppEvent({
      eventName: "task_updated",
      route: "/tasks",
      entityType: "task",
      entityId: 42,
      metadata: {
        changedFields: ["priority"],
        appSessionId: "cannot-override-reserved-context",
      },
    });

    const insertCall = execute.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO app_events"),
    );
    expect(insertCall).toBeDefined();

    const values = insertCall?.[1] as unknown[];
    const metadata = JSON.parse(String(values[4]));
    expect(values.slice(0, 4)).toEqual([
      "task_updated",
      "/tasks",
      "task",
      "42",
    ]);
    expect(metadata).toMatchObject({
      changedFields: ["priority"],
      appSessionSequence: expect.any(Number),
      clientLocalDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      clientOccurredAt: expect.any(String),
      clientTimezone: expect.any(String),
      visibilityState: expect.any(String),
    });
    expect(metadata.appSessionId).not.toBe("cannot-override-reserved-context");
  });

  it("keeps session context when event-specific metadata is truncated", async () => {
    await recordAppEvent({
      eventName: "diagnostic_payload",
      metadata: { diagnostic: "x".repeat(5_000) },
    });

    const insertCall = execute.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO app_events"),
    );
    const values = insertCall?.[1] as unknown[];
    const metadata = JSON.parse(String(values[4]));
    expect(metadata).toMatchObject({
      truncated: true,
      appSessionId: expect.any(String),
      appSessionSequence: expect.any(Number),
      clientLocalDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
