import { describe, expect, it } from "vitest";

import { workOrderProgressStep } from "@/lib/work-order-progress";
import type { WorkOrder } from "@/types/database";

const base = (overrides: Partial<WorkOrder>): WorkOrder =>
  ({
    status: "Open",
    is_closed: false,
    ...overrides,
  }) as WorkOrder;

describe("workOrderProgressStep", () => {
  it("tracks lifecycle steps", () => {
    expect(workOrderProgressStep(base({ status: "Open" }))).toBe(0);
    expect(workOrderProgressStep(base({ status: "In Progress" }))).toBe(1);
    expect(workOrderProgressStep(base({ status: "Done" }))).toBe(2);
    expect(workOrderProgressStep(base({ status: "Done", is_closed: true }))).toBe(4);
  });
});
