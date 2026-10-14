import type { WorkOrderRow } from "@/types/database";

export type StatusTab =
  | "all"
  | "open"
  | "in-progress"
  | "awaiting-review"
  | "attested";

export interface StatusTabConfig {
  value: StatusTab;
  label: string;
}

export const STATUS_TABS: StatusTabConfig[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In progress" },
  { value: "awaiting-review", label: "Awaiting review" },
  { value: "attested", label: "Attested" },
];

export function parseStatusTab(value: string | null): StatusTab {
  const match = STATUS_TABS.find((tab) => tab.value === value);
  return match ? match.value : "all";
}

type FilterableOrder = Pick<WorkOrderRow, "status" | "is_closed">;

export function matchesTab(order: FilterableOrder, tab: StatusTab): boolean {
  switch (tab) {
    case "open":
      return order.status === "Open";
    case "in-progress":
      return order.status === "In Progress";
    case "awaiting-review":
      return order.status === "Done" && !order.is_closed;
    case "attested":
      return order.is_closed;
    default:
      return true;
  }
}

export function matchesSearch(order: WorkOrderRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [
    order.work_order_number,
    order.title,
    order.issue,
    order.assignee?.full_name ?? "",
  ].some((field) => field.toLowerCase().includes(needle));
}
