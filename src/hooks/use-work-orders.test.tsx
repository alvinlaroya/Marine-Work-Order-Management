/** @vitest-environment jsdom */
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useLatestRejections,
  useRejections,
  useWorkOrder,
  useWorkOrders,
} from "@/hooks/use-work-orders";
import { createMockSessionContext } from "@/test/mock-session-context";
import { createSupabaseClientMock } from "@/test/mock-supabase";
import { renderHookWithClient } from "@/test/render-with-query-client";
import type { WorkOrderRow } from "@/types/database";

const useSessionContext = vi.fn();

vi.mock("@/hooks/use-session-context", () => ({
  useSessionContext: () => useSessionContext(),
}));

const getSupabaseBrowserClient = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => getSupabaseBrowserClient(),
}));

const workOrder = (overrides: Partial<WorkOrderRow> = {}): WorkOrderRow =>
  ({
    id: "wo-1",
    work_order_number: "WO-0001",
    title: "Fix pump",
    issue: "Leak",
    status: "Open",
    vessel_id: "vessel-1",
    assigned_crew_id: "profile-1",
    is_closed: false,
    ...overrides,
  }) as WorkOrderRow;

describe("useWorkOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionContext.mockReturnValue(createMockSessionContext());
  });

  it("loads work orders for the selected vessel when scope is ready", async () => {
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          work_orders: { data: [workOrder()], error: null },
        },
      }),
    );

    const { result } = renderHookWithClient(() => useWorkOrders());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.work_order_number).toBe("WO-0001");
  });

  it("returns an empty list when no vessel is selected", async () => {
    useSessionContext.mockReturnValue(
      createMockSessionContext({ vesselId: null, vessel: null }),
    );

    const { result } = renderHookWithClient(() => useWorkOrders());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it("does not fetch until the session scope is ready", () => {
    useSessionContext.mockReturnValue(createMockSessionContext({ scopeReady: false }));

    renderHookWithClient(() => useWorkOrders());

    expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
  });
});

describe("useWorkOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionContext.mockReturnValue(createMockSessionContext());
  });

  it("loads a single work order by id", async () => {
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          work_orders: { data: workOrder({ id: "wo-99" }), error: null },
        },
      }),
    );

    const { result } = renderHookWithClient(() => useWorkOrder("wo-99"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("wo-99");
  });
});

describe("useLatestRejections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionContext.mockReturnValue(createMockSessionContext());
  });

  it("maps the newest rejection per work order", async () => {
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          work_order_rejections: {
            data: [
              {
                work_order_id: "wo-1",
                reason: "Latest",
                created_at: "2026-01-02T00:00:00.000Z",
                rejected_by: { full_name: "Captain" },
              },
              {
                work_order_id: "wo-1",
                reason: "Older",
                created_at: "2026-01-01T00:00:00.000Z",
                rejected_by: { full_name: "Captain" },
              },
            ],
            error: null,
          },
        },
      }),
    );

    const { result } = renderHookWithClient(() => useLatestRejections());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.["wo-1"]?.reason).toBe("Latest");
  });
});

describe("useRejections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionContext.mockReturnValue(createMockSessionContext());
  });

  it("loads rejection history when enabled", async () => {
    getSupabaseBrowserClient.mockReturnValue(
      createSupabaseClientMock({
        tables: {
          work_order_rejections: {
            data: [{ id: "r1", reason: "Redo wiring", created_at: "2026-01-01T00:00:00.000Z" }],
            error: null,
          },
        },
      }),
    );

    const { result } = renderHookWithClient(() => useRejections("wo-1", true));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("stays idle when disabled", () => {
    renderHookWithClient(() => useRejections("wo-1", false));
    expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
  });
});
