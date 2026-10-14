/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider, useSessionContext } from "@/hooks/use-session-context";
import { createSupabaseClientMock } from "@/test/mock-supabase";

const getSupabaseBrowserClient = vi.fn();
const switchMockSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => getSupabaseBrowserClient(),
}));

vi.mock("@/lib/supabase/rpc", () => ({
  switchMockSession: (...args: unknown[]) => switchMockSession(...args),
}));

function renderSessionHook() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useSessionContext(), { wrapper });
}

describe("SessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    switchMockSession.mockResolvedValue({ data: {}, error: null });
  });

  it("hydrates an existing mock session and vessel scope for a captain", async () => {
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          mock_sessions: {
            data: {
              active_profile_id: "cap-1",
              active_vessel_id: "v1",
              profile: {
                id: "cap-1",
                email: "cap@fleet.local",
                full_name: "Captain Kim",
                role: "Captain",
                is_active: true,
              },
            },
            error: null,
          },
          vessels: {
            data: [{ id: "v1", name: "MV Ocean Star", is_active: true }],
            error: null,
          },
          vessel_assignments: {
            data: [{ vessel_id: "v1" }],
            error: null,
          },
        },
      }),
    );

    const { result } = renderSessionHook();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.profile?.full_name).toBe("Captain Kim");
    expect(result.current.vesselId).toBe("v1");
    expect(result.current.hasVesselAccess).toBe(true);
    expect(result.current.scopeReady).toBe(true);
  });

  it("bootstraps the first active admin when no session profile exists", async () => {
    let mockSessionReads = 0;
    const client = createSupabaseClientMock({
      tables: {
        mock_sessions: () => {
          mockSessionReads += 1;
          if (mockSessionReads === 1) {
            return { data: { active_profile_id: null, profile: null }, error: null };
          }
          return {
            data: {
              active_profile_id: "admin-1",
              active_vessel_id: null,
              profile: {
                id: "admin-1",
                email: "admin@fleet.local",
                full_name: "Fleet Admin",
                role: "Admin",
                is_active: true,
              },
            },
            error: null,
          };
        },
        profiles: {
          data: {
            id: "admin-1",
            email: "admin@fleet.local",
            full_name: "Fleet Admin",
            role: "Admin",
            is_active: true,
          },
          error: null,
        },
        vessels: {
          data: [{ id: "v1", name: "MV Ocean Star", is_active: true }],
          error: null,
        },
      },
    });
    getSupabaseBrowserClient.mockReturnValue(client);

    const { result } = renderSessionHook();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(switchMockSession).toHaveBeenCalledWith("admin-1", null);
    expect(result.current.profile?.role).toBe("Admin");
    expect(result.current.hasVesselAccess).toBe(true);
    expect(result.current.scopeReady).toBe(true);
  });

  it("reports missing seed data as empty", async () => {
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          mock_sessions: { data: { profile: null }, error: null },
          profiles: { data: null, error: null },
        },
      }),
    );

    const { result } = renderSessionHook();

    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.profile).toBeNull();
  });
});
