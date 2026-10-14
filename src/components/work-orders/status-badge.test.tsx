/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/work-orders/status-badge";

describe("StatusBadge", () => {
  it("renders open and in-progress labels", () => {
    render(<StatusBadge status="Open" />);
    expect(screen.getByText("Open")).toBeInTheDocument();

    render(<StatusBadge status="In Progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("distinguishes done awaiting review from attested", () => {
    render(<StatusBadge status="Done" />);
    expect(screen.getByText("Done · Awaiting review")).toBeInTheDocument();

    render(<StatusBadge status="Done" closed />);
    expect(screen.getByText("Done · Attested")).toBeInTheDocument();
  });
});
