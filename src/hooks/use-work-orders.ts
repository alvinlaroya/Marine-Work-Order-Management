"use client";

import { useQuery } from "@tanstack/react-query";

import { useSessionContext } from "@/hooks/use-session-context";
import { queryKeys } from "@/lib/query-keys";
import { latestRejectionByWorkOrder } from "@/lib/rejections";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RejectionRow, WorkOrderEventRow, WorkOrderRow } from "@/types/database";

const WORK_ORDER_SELECT = [
  "*",
  "vessel:vessels(name)",
  "assignee:profiles!assigned_crew_id(full_name)",
  "creator:profiles!created_by_id(full_name)",
  "attester:profiles!attested_by_id(full_name)",
].join(", ");

/** Work orders for the selected vessel; row access is enforced by RLS. */
export function useWorkOrders() {
  const { scopeReady, profile, vesselId } = useSessionContext();

  return useQuery({
    queryKey: queryKeys.workOrders(profile?.id, vesselId),
    enabled: scopeReady,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<WorkOrderRow[]> => {
      if (!vesselId) {
        return [];
      }
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("work_orders")
        .select(WORK_ORDER_SELECT)
        .eq("vessel_id", vesselId)
        .order("updated_at", { ascending: false });
      if (error) {
        throw error;
      }
      return data as unknown as WorkOrderRow[];
    },
  });
}

export function useWorkOrder(workOrderId: string) {
  const { scopeReady, profile } = useSessionContext();

  return useQuery({
    queryKey: queryKeys.workOrder(workOrderId, profile?.id),
    enabled: scopeReady,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<WorkOrderRow | null> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("work_orders")
        .select(WORK_ORDER_SELECT)
        .eq("id", workOrderId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data as unknown as WorkOrderRow | null;
    },
  });
}

/** Crew activity log (started / completed) for a work order. */
export function useWorkOrderEvents(workOrderId: string, enabled: boolean) {
  const { profile } = useSessionContext();

  return useQuery({
    queryKey: [...queryKeys.events(workOrderId), profile?.id ?? ""],
    enabled,
    queryFn: async (): Promise<WorkOrderEventRow[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("work_order_events")
        .select("*, actor:profiles!actor_id(full_name)")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      return data as unknown as WorkOrderEventRow[];
    },
  });
}

/** Most recent Captain rejection for a work order. */
export interface LatestRejection {
  work_order_id: string;
  reason: string;
  created_at: string;
  rejected_by: { full_name: string } | null;
}

/**
 * Latest rejection per work order on the selected vessel, keyed by work order id.
 * Row access is enforced by RLS (Crew only see rejections on their own orders).
 */
export function useLatestRejections() {
  const { scopeReady, profile, vesselId } = useSessionContext();

  return useQuery({
    queryKey: queryKeys.workOrders(`rejections-${profile?.id ?? ""}`, vesselId),
    enabled: scopeReady,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Record<string, LatestRejection>> => {
      if (!vesselId) {
        return {};
      }
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("work_order_rejections")
        .select(
          "work_order_id, reason, created_at, rejected_by:profiles!rejected_by_id(full_name), work_order:work_orders!inner(vessel_id)",
        )
        .eq("work_order.vessel_id", vesselId)
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      return latestRejectionByWorkOrder((data ?? []) as unknown as LatestRejection[]);
    },
  });
}

export function useRejections(workOrderId: string, enabled: boolean) {
  const { profile } = useSessionContext();

  return useQuery({
    queryKey: [...queryKeys.rejections(workOrderId), profile?.id ?? ""],
    enabled,
    queryFn: async (): Promise<RejectionRow[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("work_order_rejections")
        .select("*, rejected_by:profiles!rejected_by_id(full_name)")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      return data as unknown as RejectionRow[];
    },
  });
}
