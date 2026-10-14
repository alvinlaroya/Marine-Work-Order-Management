/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { RejectedOrdersAlert } from "@/components/dashboard/rejected-orders-alert";
import type { WorkOrderRow } from "@/types/database";

const order = (overrides: Partial<WorkOrderRow>): WorkOrderRow =>
  ({
    id: "wo1",
    work_order_number: "WO-0001",
    title: "Fix pump",
    ...overrides,
  }) as WorkOrderRow;

describe("RejectedOrdersAlert", () => {
  it("renders nothing when there are no orders", () => {
    const { container } = render(<RejectedOrdersAlert orders={[]} rejections={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows rejection details for crew rework", () => {
    render(
      <RejectedOrdersAlert
        orders={[order({})]}
        rejections={{
          wo1: {
            work_order_id: "wo1",
            reason: "Add photo evidence",
            created_at: "2026-01-15T10:00:00.000Z",
            rejected_by: { full_name: "Captain Kim" },
          },
        }}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/1 work order was rejected/)).toBeInTheDocument();
    expect(screen.getByText(/Add photo evidence/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/work-orders/wo1");
  });
});
