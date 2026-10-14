import { describe, expect, it } from "vitest";

import {
  buildAttentionList,
  crewRejectedOrders,
  oldestFirst,
  visibleAttentionItems,
} from "@/lib/dashboard-attention";
import type { WorkOrderRow } from "@/types/database";

const order = (overrides: Partial<WorkOrderRow>): WorkOrderRow =>
  ({
    id: overrides.id ?? "wo",
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    status: "Open",
    is_closed: false,
    ...overrides,
  }) as WorkOrderRow;

describe("oldestFirst", () => {
  it("sorts by created_at ascending", () => {
    const sorted = oldestFirst([
      order({ id: "b", created_at: "2026-01-02T00:00:00.000Z" }),
      order({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("buildAttentionList", () => {
  const orders = [
    order({ id: "open", status: "Open" }),
    order({ id: "wip", status: "In Progress" }),
    order({ id: "review", status: "Done", is_closed: false }),
    order({ id: "closed", status: "Done", is_closed: true }),
  ];

  it("filters captain review queue", () => {
    expect(buildAttentionList("Captain", orders).items.map((row) => row.id)).toEqual([
      "review",
    ]);
  });

  it("filters crew active work", () => {
    expect(buildAttentionList("Crew", orders).items.map((row) => row.id)).toEqual([
      "open",
      "wip",
    ]);
  });

  it("shows all orders for admin with latest flag", () => {
    const list = buildAttentionList("Admin", orders);
    expect(list.items).toHaveLength(4);
    expect(list.latest).toBe(true);
  });
});

describe("visibleAttentionItems", () => {
  it("shows oldest five or latest five depending on role list", () => {
    const items = Array.from({ length: 7 }, (_, index) =>
      order({ id: `wo-${index}`, created_at: `2026-01-0${index + 1}T00:00:00.000Z` }),
    );
    const captainOrders = Array.from({ length: 7 }, (_, index) =>
      order({
        id: `review-${index}`,
        status: "Done",
        is_closed: false,
        created_at: `2026-01-0${index + 1}T00:00:00.000Z`,
      }),
    );
    const captainList = buildAttentionList("Captain", captainOrders);
    expect(visibleAttentionItems(captainList, oldestFirst(captainList.items))).toHaveLength(5);

    const adminList = buildAttentionList("Admin", items);
    const sorted = oldestFirst(adminList.items);
    expect(visibleAttentionItems(adminList, sorted).map((row) => row.id)).toEqual([
      "wo-2",
      "wo-3",
      "wo-4",
      "wo-5",
      "wo-6",
    ]);
  });
});

describe("crewRejectedOrders", () => {
  it("lists in-progress orders that have a rejection record", () => {
    const orders = [
      order({ id: "a", status: "In Progress" }),
      order({ id: "b", status: "Open" }),
      order({ id: "c", status: "In Progress" }),
    ];
    const rejections = { a: { reason: "Fix wiring" } };
    expect(crewRejectedOrders(orders, rejections).map((row) => row.id)).toEqual(["a"]);
  });
});
