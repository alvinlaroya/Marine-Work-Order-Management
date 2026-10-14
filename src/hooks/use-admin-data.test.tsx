/** @vitest-environment jsdom */
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAllAssignments,
  useAllProfiles,
  useAllVessels,
  useInvalidateAdminData,
} from "@/hooks/use-admin-data";
import { queryKeys } from "@/lib/query-keys";
import { createMockSessionContext } from "@/test/mock-session-context";
import { createSupabaseClientMock } from "@/test/mock-supabase";
import { createTestQueryClient, renderHookWithClient } from "@/test/render-with-query-client";

const useSessionContext = vi.fn();

vi.mock("@/hooks/use-session-context", () => ({
  useSessionContext: () => useSessionContext(),
}));

const getSupabaseBrowserClient = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => getSupabaseBrowserClient(),
}));

describe("use-admin-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads admin lists for an active admin session", async () => {
    useSessionContext.mockReturnValue(
      createMockSessionContext({
        profile: {
          id: "admin-1",
          email: "admin@fleet.local",
          full_name: "Admin User",
          role: "Admin",
          is_active: true,
          created_at: "",
          updated_at: "",
        },
        roleFilter: "Admin",
      }),
    );
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          profiles: { data: [{ id: "admin-1", full_name: "Admin User", role: "Admin" }], error: null },
          vessels: { data: [{ id: "v1", name: "MV Test" }], error: null },
          vessel_assignments: { data: [{ id: "a1", profile_id: "p1", vessel_id: "v1" }], error: null },
        },
      }),
    );

    const profiles = renderHookWithClient(() => useAllProfiles());
    const vessels = renderHookWithClient(() => useAllVessels());
    const assignments = renderHookWithClient(() => useAllAssignments());

    await waitFor(() => expect(profiles.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(vessels.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(assignments.result.current.isSuccess).toBe(true));

    expect(profiles.result.current.data).toHaveLength(1);
    expect(vessels.result.current.data?.[0]?.name).toBe("MV Test");
    expect(assignments.result.current.data).toHaveLength(1);
  });

  it("does not fetch admin lists for non-admin roles", () => {
    useSessionContext.mockReturnValue(
      createMockSessionContext({
        profile: {
          id: "cap-1",
          email: "cap@fleet.local",
          full_name: "Captain",
          role: "Captain",
          is_active: true,
          created_at: "",
          updated_at: "",
        },
        roleFilter: "Captain",
      }),
    );

    renderHookWithClient(() => useAllProfiles());
    renderHookWithClient(() => useAllVessels());
    renderHookWithClient(() => useAllAssignments());

    expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it("invalidates admin-related query prefixes", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { renderHook } = await import("@testing-library/react");
    const { QueryClientProvider } = await import("@tanstack/react-query");

    useSessionContext.mockReturnValue(createMockSessionContext());

    const { result } = renderHook(() => useInvalidateAdminData(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await result.current();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.profiles() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.vessels() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.assignments() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.assignedVessels() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workOrders() });
  });
});
