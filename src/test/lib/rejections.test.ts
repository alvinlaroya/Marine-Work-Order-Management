import { describe, expect, it } from "vitest";

import { latestRejectionByWorkOrder } from "@/lib/rejections";

describe("latestRejectionByWorkOrder", () => {
  it("keeps the first row per work order when rows are newest-first", () => {
    const map = latestRejectionByWorkOrder([
      { work_order_id: "a", reason: "new" },
      { work_order_id: "a", reason: "old" },
      { work_order_id: "b", reason: "only" },
    ]);
    expect(map.a?.reason).toBe("new");
    expect(map.b?.reason).toBe("only");
  });
});
