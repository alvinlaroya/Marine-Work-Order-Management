/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("shows initials from the display name", () => {
    render(<Avatar name="Sam Rivera" />);
    expect(screen.getByText("SR")).toBeInTheDocument();
  });
});
