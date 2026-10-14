import { describe, expect, it } from "vitest";

import {
  matchesSearch,
  matchesTab,
  parseStatusTab,
} from "@/lib/work-order-filters";
import type { WorkOrderRow } from "@/types/database";

const order = (overrides: Partial<WorkOrderRow>): WorkOrderRow =>
  ({
    work_order_number: "WO-0001",
    title: "Replace pump",
    issue: "Bilge pump is leaking",
    status: "Open",
    is_closed: false,
    assignee: { full_name: "Sam Rivera" },
    ...overrides,
  }) as WorkOrderRow;

describe("parseStatusTab", () => {
  it("accepts known tabs and falls back to all", () => {
    expect(parseStatusTab("in-progress")).toBe("in-progress");
    expect(parseStatusTab("bogus")).toBe("all");
    expect(parseStatusTab(null)).toBe("all");
  });
});

describe("matchesTab", () => {
  it("separates done awaiting review from attested", () => {
    const done = order({ status: "Done", is_closed: false });
    const attested = order({ status: "Done", is_closed: true });
    expect(matchesTab(done, "awaiting-review")).toBe(true);
    expect(matchesTab(attested, "awaiting-review")).toBe(false);
    expect(matchesTab(attested, "attested")).toBe(true);
  });

  it("filters by open and in progress", () => {
    expect(matchesTab(order({ status: "Open" }), "open")).toBe(true);
    expect(matchesTab(order({ status: "In Progress" }), "open")).toBe(false);
    expect(matchesTab(order({ status: "In Progress" }), "in-progress")).toBe(true);
    expect(matchesTab(order({}), "all")).toBe(true);
  });
});

describe("matchesSearch", () => {
  it("matches number, title, issue and assignee case-insensitively", () => {
    expect(matchesSearch(order({}), "wo-0001")).toBe(true);
    expect(matchesSearch(order({}), "PUMP")).toBe(true);
    expect(matchesSearch(order({}), "leaking")).toBe(true);
    expect(matchesSearch(order({}), "rivera")).toBe(true);
    expect(matchesSearch(order({}), "engine")).toBe(false);
    expect(matchesSearch(order({}), "   ")).toBe(true);
  });
});
