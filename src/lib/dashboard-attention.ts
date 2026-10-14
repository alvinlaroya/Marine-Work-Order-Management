import type { UserRole, WorkOrderRow } from "@/types/database";

export interface AttentionList {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: WorkOrderRow[];
  /** Show the most recent items (still ordered oldest to newest) instead of the oldest ones. */
  latest?: boolean;
}

/** Orders sorted from oldest to newest by creation time. */
export function oldestFirst(orders: WorkOrderRow[]): WorkOrderRow[] {
  return [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function buildAttentionList(role: UserRole, orders: WorkOrderRow[]): AttentionList {
  if (role === "Captain") {
    return {
      title: "Waiting for your review",
      description: "Completed work orders to attest or reject",
      emptyTitle: "Nothing to review",
      emptyDescription: "Completed work orders from your crew will appear here.",
      items: orders.filter((order) => order.status === "Done" && !order.is_closed),
    };
  }
  if (role === "Crew") {
    return {
      title: "Your next tasks",
      description: "Open and in-progress work orders assigned to you",
      emptyTitle: "You are all caught up",
      emptyDescription: "New assignments from your Captain will show up here.",
      items: orders.filter((order) => order.status !== "Done"),
    };
  }
  return {
    title: "Latest work orders",
    description: "The most recent work orders on this vessel, oldest first",
    emptyTitle: "No work orders yet",
    emptyDescription: "Work orders created by the Captain will appear here.",
    items: orders,
    latest: true,
  };
}

export function visibleAttentionItems(
  attention: AttentionList,
  sortedItems: WorkOrderRow[],
): WorkOrderRow[] {
  return attention.latest ? sortedItems.slice(-5) : sortedItems.slice(0, 5);
}

/** In-progress orders with a recorded rejection (Captain sent them back for rework). */
export function crewRejectedOrders(
  orders: WorkOrderRow[],
  rejections: Record<string, unknown>,
): WorkOrderRow[] {
  return oldestFirst(
    orders.filter((order) => order.status === "In Progress" && rejections[order.id]),
  );
}
