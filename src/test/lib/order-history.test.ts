import { describe, expect, it } from "vitest";

import { buildWorkOrderHistory } from "@/lib/order-history";
import type { RejectionRow, WorkOrderEventRow, WorkOrderRow } from "@/types/database";

const baseOrder = (overrides: Partial<WorkOrderRow> = {}): WorkOrderRow =>
  ({
    id: "wo1",
    created_at: "2026-01-01T10:00:00.000Z",
    creator: { full_name: "Captain Kim" },
    assignee: { full_name: "Sam Crew" },
    is_closed: false,
    attested_at: null,
    ...overrides,
  }) as WorkOrderRow;

describe("buildWorkOrderHistory", () => {
  it("includes creation, events, rejections and attestation newest-first", () => {
    const events = [
      {
        id: "e1",
        event_type: "started",
        created_at: "2026-01-02T10:00:00.000Z",
        actor: { full_name: "Sam Crew" },
      },
      {
        id: "e2",
        event_type: "completed",
        created_at: "2026-01-03T10:00:00.000Z",
        note: "Replaced gasket",
        actor: { full_name: "Sam Crew" },
      },
    ] as WorkOrderEventRow[];

    const rejections = [
      {
        id: "r1",
        created_at: "2026-01-04T10:00:00.000Z",
        reason: "Photo missing",
        rejected_by: { full_name: "Captain Kim" },
      },
    ] as RejectionRow[];

    const attested = baseOrder({
      is_closed: true,
      attested_at: "2026-01-05T10:00:00.000Z",
      attester: { full_name: "Captain Kim" },
    });

    const entries = buildWorkOrderHistory(attested, rejections, events);
    expect(entries.map((entry) => entry.key)).toEqual([
      "attested",
      "r1",
      "e2",
      "e1",
      "created",
    ]);
    expect(entries.find((entry) => entry.key === "e2")?.body).toBe(
      "Solution: Replaced gasket",
    );
  });
});
