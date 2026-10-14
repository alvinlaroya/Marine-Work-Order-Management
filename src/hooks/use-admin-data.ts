"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSessionContext } from "@/hooks/use-session-context";
import { canManageAdmin } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AssignmentRow, Profile, Vessel } from "@/types/database";

function useAdminEnabled(): boolean {
  const { scopeReady, profile } = useSessionContext();
  return scopeReady && canManageAdmin(profile);
}

export function useAllProfiles() {
  const enabled = useAdminEnabled();
  return useQuery({
    queryKey: queryKeys.profiles("admin-all"),
    enabled,
    queryFn: async (): Promise<Profile[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) {
        throw error;
      }
      return data as Profile[];
    },
  });
}

export function useAllVessels() {
  const enabled = useAdminEnabled();
  return useQuery({
    queryKey: queryKeys.vessels("admin-all"),
    enabled,
    queryFn: async (): Promise<Vessel[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("vessels")
        .select("*")
        .order("name");
      if (error) {
        throw error;
      }
      return data as Vessel[];
    },
  });
}

/** Every assignment, including removed ones, so removed members can be re-assigned. */
export function useAllAssignments() {
  const enabled = useAdminEnabled();
  return useQuery({
    queryKey: queryKeys.assignments("admin-all"),
    enabled,
    queryFn: async (): Promise<AssignmentRow[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("vessel_assignments")
        .select("*, profile:profiles(*), vessel:vessels(*)")
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      return data as unknown as AssignmentRow[];
    },
  });
}

/** Refreshes everything an admin mutation can affect (lists, switcher, scopes). */
export function useInvalidateAdminData(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.vessels() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignedVessels() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders() }),
    ]);
  }, [queryClient]);
}
