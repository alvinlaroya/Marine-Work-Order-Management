import { describe, expect, it } from "vitest";

import { ADMIN_NAV, isActivePath, WORKSPACE_NAV } from "@/components/layout/nav-items";

describe("nav items", () => {
  it("includes workspace and admin destinations", () => {
    expect(WORKSPACE_NAV.map((item) => item.href)).toEqual([
      "/dashboard",
      "/work-orders",
    ]);
    expect(ADMIN_NAV.map((item) => item.href)).toEqual([
      "/admin/users",
      "/admin/vessels",
      "/admin/assignments",
    ]);
  });

  it("matches exact and nested paths", () => {
    expect(isActivePath("/work-orders", "/work-orders")).toBe(true);
    expect(isActivePath("/work-orders/abc", "/work-orders")).toBe(true);
    expect(isActivePath("/work-orders-old", "/work-orders")).toBe(false);
  });
});
