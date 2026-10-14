"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { queryKeys } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { switchMockSession } from "@/lib/supabase/rpc";
import { parseSupabaseError } from "@/lib/validation";
import type { MockSession, Profile, UserRole, Vessel } from "@/types/database";

type SessionStatus = "loading" | "ready" | "empty" | "error";

interface SessionState {
  session: MockSession;
  profile: Profile;
}

interface SessionContextValue {
  status: SessionStatus;
  error: string | null;
  profile: Profile | null;
  vessels: Vessel[];
  vessel: Vessel | null;
  /** Resolved vessel scope: the selected vessel, or the first active vessel. */
  vesselId: string | null;
  /** True when the active member may access the resolved vessel. */
  hasVesselAccess: boolean;
  /** True once the session, vessels and assignments needed for scoping are loaded. */
  scopeReady: boolean;
  roleFilter: UserRole;
  setRoleFilter: (role: UserRole) => void;
  selectVessel: (vesselId: string) => void;
  switchMember: (profileId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function ensureAnonymousAuth(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw error;
    }
  }
}

interface SessionRow extends MockSession {
  profile: Profile | null;
}

async function fetchSessionRow(): Promise<SessionRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("mock_sessions")
    .select("*, profile:profiles!active_profile_id(*)")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as SessionRow | null;
}

/** Loads the browser's mock session, starting as the first Admin on first visit. */
async function loadSession(): Promise<SessionState | null> {
  await ensureAnonymousAuth();

  let row = await fetchSessionRow();

  if (!row?.profile) {
    const supabase = getSupabaseBrowserClient();
    const { data: admin, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "Admin")
      .eq("is_active", true)
      .order("full_name")
      .limit(1)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!admin) {
      return null;
    }
    const { error: switchError } = await switchMockSession(admin.id, null);
    if (switchError) {
      throw switchError;
    }
    row = await fetchSessionRow();
  }

  if (!row?.profile) {
    return null;
  }

  const { profile, ...session } = row;
  return { session, profile };
}

async function fetchActiveVessels(): Promise<Vessel[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vessels")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) {
    throw error;
  }
  return data as Vessel[];
}

async function fetchAssignedVesselIds(profileId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vessel_assignments")
    .select("vessel_id")
    .eq("profile_id", profileId)
    .eq("is_active", true);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row: { vessel_id: string }) => row.vessel_id);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [vesselOverride, setVesselOverride] = useState<string | null>(null);
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(null);

  const sessionQuery = useQuery({
    queryKey: queryKeys.session,
    queryFn: loadSession,
    retry: false,
    staleTime: Infinity,
  });

  const sessionState = sessionQuery.data ?? null;
  const profile = sessionState?.profile ?? null;

  const vesselsQuery = useQuery({
    queryKey: queryKeys.vessels("active"),
    queryFn: fetchActiveVessels,
    enabled: Boolean(sessionState),
    staleTime: 30_000,
  });

  const assignedQuery = useQuery({
    queryKey: queryKeys.assignedVessels(profile?.id),
    queryFn: () => fetchAssignedVesselIds(profile?.id ?? ""),
    enabled: Boolean(profile) && profile?.role !== "Admin",
    staleTime: 30_000,
  });

  const vessels = useMemo(() => vesselsQuery.data ?? [], [vesselsQuery.data]);
  const preferred = vesselOverride ?? sessionState?.session.active_vessel_id;
  const vessel =
    vessels.find((item) => item.id === preferred) ?? vessels[0] ?? null;
  const vesselId = vessel?.id ?? null;

  const hasVesselAccess =
    profile?.role === "Admin" ||
    (vesselId !== null && (assignedQuery.data ?? []).includes(vesselId));

  const scopeReady =
    Boolean(profile) &&
    vesselsQuery.isSuccess &&
    (profile?.role === "Admin" || assignedQuery.isSuccess);

  const switchMember = useCallback(
    async (profileId: string) => {
      const { error } = await switchMockSession(profileId, vesselId);
      if (error) {
        throw error;
      }
      setRoleOverride(null);
      await queryClient.invalidateQueries();
    },
    [queryClient, vesselId],
  );

  const status: SessionStatus = sessionQuery.isPending
    ? "loading"
    : sessionQuery.isError
      ? "error"
      : sessionState
        ? "ready"
        : "empty";

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      error: sessionQuery.isError ? parseSupabaseError(sessionQuery.error) : null,
      profile,
      vessels,
      vessel,
      vesselId,
      hasVesselAccess,
      scopeReady,
      roleFilter: roleOverride ?? profile?.role ?? "Admin",
      setRoleFilter: setRoleOverride,
      selectVessel: setVesselOverride,
      switchMember,
    }),
    [
      status,
      sessionQuery.isError,
      sessionQuery.error,
      profile,
      vessels,
      vessel,
      vesselId,
      hasVesselAccess,
      scopeReady,
      roleOverride,
      switchMember,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used within SessionProvider");
  }
  return ctx;
}
