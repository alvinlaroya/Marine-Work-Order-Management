/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleBadge } from "@/components/common/role-badge";

describe("RoleBadge", () => {
  it("renders each role label", () => {
    render(<RoleBadge role="Admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    render(<RoleBadge role="Captain" />);
    expect(screen.getByText("Captain")).toBeInTheDocument();
    render(<RoleBadge role="Crew" />);
    expect(screen.getByText("Crew")).toBeInTheDocument();
  });
});
