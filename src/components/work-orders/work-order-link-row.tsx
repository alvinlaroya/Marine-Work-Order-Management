import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/work-orders/status-badge";
import { timeAgo } from "@/lib/format";
import type { WorkOrderRow } from "@/types/database";

/** Compact, fully clickable work order row used by dashboard lists. */
export function WorkOrderLinkRow({ order }: { order: WorkOrderRow }) {
  return (
    <Link
      href={`/work-orders/${order.id}`}
      className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs text-muted-foreground">
            {order.work_order_number}
          </span>
          <StatusBadge status={order.status} closed={order.is_closed} />
        </div>
        <p className="truncate text-sm font-medium">{order.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {order.assignee?.full_name ?? "Unassigned"} · updated{" "}
          {timeAgo(order.updated_at)}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
