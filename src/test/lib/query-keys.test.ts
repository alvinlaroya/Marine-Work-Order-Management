import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";

describe("queryKeys", () => {
  it("uses stable session key", () => {
    expect(queryKeys.session).toEqual(["session"]);
  });

  it("scopes resources and supports prefix invalidation", () => {
    expect(queryKeys.vessels()).toEqual(["vessels"]);
    expect(queryKeys.vessels("admin")).toEqual(["vessels", "admin"]);
    expect(queryKeys.workOrders("p1", "v1")).toEqual(["workOrders", "p1", "v1"]);
    expect(queryKeys.workOrder("wo1", "p1")).toEqual(["workOrder", "wo1", "p1"]);
    expect(queryKeys.rejections("wo1")).toEqual(["rejections", "wo1"]);
    expect(queryKeys.events("wo1")).toEqual(["events", "wo1"]);
  });
});
