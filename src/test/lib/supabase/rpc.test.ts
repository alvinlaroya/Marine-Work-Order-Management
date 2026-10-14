import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ rpc }),
}));

import {
  adminRemoveAssignment,
  captainAttestWorkOrder,
  createWorkOrder,
  switchMockSession,
} from "@/lib/supabase/rpc";

describe("supabase rpc wrappers", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("forwards switch_mock_session args", async () => {
    rpc.mockResolvedValue({ data: { active_profile_id: "p1" }, error: null });
    await switchMockSession("p1", "v1");
    expect(rpc).toHaveBeenCalledWith("switch_mock_session", {
      p_profile_id: "p1",
      p_vessel_id: "v1",
    });
  });

  it("maps rpc errors to Error instances", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Not allowed" } });
    const result = await createWorkOrder({
      p_title: "T",
      p_issue: "Issue text here",
      p_vessel_id: "v1",
      p_assigned_crew_id: "c1",
    });
    expect(result.error?.message).toBe("Not allowed");
  });

  it("returns null data for admin_remove_assignment", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await adminRemoveAssignment("a1");
    expect(result).toEqual({ data: null, error: null });
  });

  it("passes work order id to captain attestation", async () => {
    rpc.mockResolvedValue({ data: { id: "wo1" }, error: null });
    await captainAttestWorkOrder("wo1");
    expect(rpc).toHaveBeenCalledWith("captain_attest_work_order", {
      p_work_order_id: "wo1",
    });
  });
});
