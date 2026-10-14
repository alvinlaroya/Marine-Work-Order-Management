import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Profile,
  UserRole,
  Vessel,
  VesselAssignment,
  WorkOrder,
  WorkOrderStatus,
  MockSession,
} from "@/types/database";

type RpcResult<T> = Promise<{ data: T | null; error: Error | null }>;

function rpcError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  const supabase = getSupabaseBrowserClient() as SupabaseClient;
  const { data, error } = await supabase.rpc(name, args);
  return { data: data as T | null, error: rpcError(error) };
}

export async function switchMockSession(
  profileId: string,
  vesselId?: string | null,
): RpcResult<MockSession> {
  return callRpc<MockSession>("switch_mock_session", {
    p_profile_id: profileId,
    p_vessel_id: vesselId ?? null,
  });
}

export async function adminUpsertProfile(args: {
  p_id: string | null;
  p_email: string;
  p_full_name: string;
  p_role: UserRole;
  p_is_active: boolean;
}): RpcResult<Profile> {
  return callRpc<Profile>("admin_upsert_profile", args);
}

export async function adminDeactivateProfile(
  profileId: string,
): RpcResult<Profile> {
  return callRpc<Profile>("admin_deactivate_profile", { p_id: profileId });
}

export async function adminUpsertVessel(args: {
  p_id: string | null;
  p_name: string;
  p_imo_number: string | null;
  p_is_active: boolean;
}): RpcResult<Vessel> {
  return callRpc<Vessel>("admin_upsert_vessel", args);
}

export async function adminUpsertAssignment(args: {
  p_id: string | null;
  p_profile_id: string;
  p_vessel_id: string;
  p_is_active: boolean;
}): RpcResult<VesselAssignment> {
  return callRpc<VesselAssignment>("admin_upsert_assignment", args);
}

export async function adminRemoveAssignment(
  assignmentId: string,
): RpcResult<void> {
  const { error } = await callRpc<null>("admin_remove_assignment", {
    p_id: assignmentId,
  });
  return { data: null, error };
}

export async function createWorkOrder(args: {
  p_title: string;
  p_issue: string;
  p_vessel_id: string;
  p_assigned_crew_id: string;
}): RpcResult<WorkOrder> {
  return callRpc<WorkOrder>("create_work_order", args);
}

export async function crewUpdateWorkOrder(args: {
  p_work_order_id: string;
  p_status: WorkOrderStatus;
  p_solution?: string | null;
}): RpcResult<WorkOrder> {
  return callRpc<WorkOrder>("crew_update_work_order", args);
}

export async function captainAttestWorkOrder(
  workOrderId: string,
): RpcResult<WorkOrder> {
  return callRpc<WorkOrder>("captain_attest_work_order", {
    p_work_order_id: workOrderId,
  });
}

export async function captainRejectWorkOrder(args: {
  p_work_order_id: string;
  p_reason: string;
}): RpcResult<WorkOrder> {
  return callRpc<WorkOrder>("captain_reject_work_order", args);
}
