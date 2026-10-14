/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressStepper } from "@/components/work-orders/progress-stepper";
import type { WorkOrder } from "@/types/database";

const order = (overrides: Partial<WorkOrder>): WorkOrder =>
  ({
    status: "Open",
    is_closed: false,
    ...overrides,
  }) as WorkOrder;

function activeStepNumber(container: HTMLElement): string | undefined {
  const step = container.querySelector('[aria-current="step"]');
  return step?.querySelector(".rounded-full")?.textContent?.trim();
}

describe("ProgressStepper", () => {
  it("marks the active lifecycle step", () => {
    const { container, rerender } = render(<ProgressStepper order={order({ status: "Open" })} />);
    expect(activeStepNumber(container)).toBe("1");

    rerender(<ProgressStepper order={order({ status: "In Progress" })} />);
    expect(activeStepNumber(container)).toBe("2");

    rerender(<ProgressStepper order={order({ status: "Done" })} />);
    expect(activeStepNumber(container)).toBe("3");

    rerender(<ProgressStepper order={order({ status: "Done", is_closed: true })} />);
    expect(container.querySelector('[aria-current="step"]')).toBeNull();
  });
});
