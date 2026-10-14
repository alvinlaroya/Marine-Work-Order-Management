/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/common/pagination";

describe("Pagination", () => {
  it("returns null when there are no items", () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} totalItems={0} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows range text and navigates pages", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        pageSize={10}
        totalItems={25}
        onPageChange={onPageChange}
        itemLabel="user"
      />,
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent("11");
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
