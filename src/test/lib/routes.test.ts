import { describe, expect, it } from "vitest";

import { isAdminPath, OVERVIEW_PATH } from "@/lib/routes";

describe("routes", () => {
  it("defines the overview landing path", () => {
    expect(OVERVIEW_PATH).toBe("/dashboard");
  });

  it("detects admin routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/dashboard")).toBe(false);
    expect(isAdminPath("/work-orders")).toBe(false);
  });
});
