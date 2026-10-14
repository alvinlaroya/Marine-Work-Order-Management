import { describe, expect, it } from "vitest";

import {
  canCreateWorkOrder,
  canCrewUpdateWorkOrder,
  canManageAdmin,
  canReviewWorkOrder,
} from "@/lib/permissions";
import type { Profile, WorkOrder } from "@/types/database";

const baseProfile = (overrides: Partial<Profile>): Profile => ({
  id: "p1",
  email: "a@b.com",
  full_name: "Test",
  role: "Crew",
  is_active: true,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const baseWorkOrder = (overrides: Partial<WorkOrder>): WorkOrder => ({
  id: "wo1",
  work_order_number: "WO-1",
  title: "T",
  issue: "I",
  solution: null,
  status: "Open",
  vessel_id: "v1",
  assigned_crew_id: "p1",
  created_by_id: "c1",
  attested_at: null,
  attested_by_id: null,
  is_closed: false,
  created_at: "",
  updated_at: "",
  ...overrides,
});

describe("permissions", () => {
  it("allows admin management for active admins", () => {
    expect(canManageAdmin(baseProfile({ role: "Admin" }))).toBe(true);
    expect(canManageAdmin(baseProfile({ role: "Captain" }))).toBe(false);
  });

  it("allows captains to create work orders", () => {
    expect(canCreateWorkOrder(baseProfile({ role: "Captain" }))).toBe(true);
    expect(canCreateWorkOrder(baseProfile({ role: "Crew" }))).toBe(false);
  });

  it("allows assigned crew to update open work orders", () => {
    const crew = baseProfile({ id: "p1", role: "Crew" });
    expect(canCrewUpdateWorkOrder(crew, baseWorkOrder({ assigned_crew_id: "p1" }))).toBe(
      true,
    );
    expect(canCrewUpdateWorkOrder(crew, baseWorkOrder({ assigned_crew_id: "other" }))).toBe(
      false,
    );
  });

  it("allows captain review only for done, unclosed orders", () => {
    const captain = baseProfile({ role: "Captain" });
    expect(
      canReviewWorkOrder(
        captain,
        baseWorkOrder({ status: "Done", is_closed: false }),
      ),
    ).toBe(true);
    expect(
      canReviewWorkOrder(
        captain,
        baseWorkOrder({ status: "In Progress", is_closed: false }),
      ),
    ).toBe(false);
  });
});
