/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderHistory } from "@/components/work-orders/order-history";
import type { WorkOrderRow } from "@/types/database";

const order = (overrides: Partial<WorkOrderRow> = {}): WorkOrderRow =>
  ({
    id: "wo1",
    created_at: "2026-01-01T10:00:00.000Z",
    creator: { full_name: "Captain Kim" },
    assignee: { full_name: "Sam Crew" },
    is_closed: false,
    attested_at: null,
    ...overrides,
  }) as WorkOrderRow;

describe("OrderHistory", () => {
  it("renders timeline entries", () => {
    render(
      <OrderHistory
        order={order()}
        rejections={[]}
        events={[
          {
            id: "e1",
            event_type: "started",
            created_at: "2026-01-02T10:00:00.000Z",
            actor: { full_name: "Sam Crew" },
          },
        ]}
      />,
    );
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText(/Created by Captain Kim/)).toBeInTheDocument();
    expect(screen.getByText(/Started by Sam Crew/)).toBeInTheDocument();
  });
});
