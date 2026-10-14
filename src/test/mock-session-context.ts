import { vi } from "vitest";

import type { useSessionContext } from "@/hooks/use-session-context";
import type { Profile, UserRole, Vessel } from "@/types/database";

type SessionContextValue = ReturnType<typeof useSessionContext>;

const baseProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({
    id: "profile-1",
    email: "user@fleet.local",
    full_name: "Test User",
    role: "Captain",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as Profile;

const baseVessel = (overrides: Partial<Vessel> = {}): Vessel =>
  ({
    id: "vessel-1",
    name: "MV Ocean Star",
    imo_number: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as Vessel;

export function createMockSessionContext(
  overrides: Partial<SessionContextValue> = {},
): SessionContextValue {
  const profile = overrides.profile ?? baseProfile();
  const vessel = overrides.vessel ?? baseVessel();
  return {
    status: "ready",
    error: null,
    profile,
    vessels: overrides.vessels ?? [vessel],
    vessel: overrides.vessel === null ? null : vessel,
    vesselId: overrides.vesselId ?? vessel.id,
    hasVesselAccess: overrides.hasVesselAccess ?? true,
    scopeReady: overrides.scopeReady ?? true,
    roleFilter: overrides.roleFilter ?? (profile.role as UserRole),
    setRoleFilter: vi.fn(),
    selectVessel: vi.fn(),
    switchMember: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
