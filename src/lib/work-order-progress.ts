import type { WorkOrder } from "@/types/database";

export const WORK_ORDER_PROGRESS_STEPS = [
  "Open",
  "In Progress",
  "Done",
  "Attested",
] as const;

/** Index of the active step in {@link WORK_ORDER_PROGRESS_STEPS}; equals step count when attested. */
export function workOrderProgressStep(
  order: Pick<WorkOrder, "is_closed" | "status">,
): number {
  if (order.is_closed) {
    return WORK_ORDER_PROGRESS_STEPS.length;
  }
  if (order.status === "Done") {
    return 2;
  }
  return order.status === "In Progress" ? 1 : 0;
}
