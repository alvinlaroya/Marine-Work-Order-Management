import { ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LatestRejection } from "@/hooks/use-work-orders";
import { timeAgo } from "@/lib/format";
import type { WorkOrderRow } from "@/types/database";

interface RejectedOrdersAlertProps {
  orders: WorkOrderRow[];
  rejections: Record<string, LatestRejection>;
}

/**
 * Shown to Crew when the Captain sent a completed work order back. The order is
 * In Progress again and needs rework before it can be resubmitted.
 */
export function RejectedOrdersAlert({ orders, rejections }: RejectedOrdersAlertProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <Card
      role="alert"
      className="border-destructive/40 bg-destructive/5 dark:bg-destructive/10"
    >
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <RotateCcw className="size-5" />
        </span>
        <div className="space-y-1">
          <CardTitle>
            {orders.length} {orders.length === 1 ? "work order was" : "work orders were"}{" "}
            rejected
          </CardTitle>
          <CardDescription>
            Your Captain sent {orders.length === 1 ? "it" : "them"} back. Review the reason,
            fix the issue and mark {orders.length === 1 ? "it" : "them"} done again.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map((order) => {
          const rejection = rejections[order.id];
          return (
            <Link
              key={order.id}
              href={`/work-orders/${order.id}`}
              className="group flex items-center gap-3 rounded-lg border border-destructive/20 bg-card p-3 transition-colors hover:border-destructive/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.work_order_number}
                  </span>
                  <Badge variant="destructive">Rejected</Badge>
                </div>
                <p className="truncate text-sm font-medium">{order.title}</p>
                {rejection ? (
                  <>
                    <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      “{rejection.reason}”
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rejection.rejected_by?.full_name ?? "The Captain"} ·{" "}
                      {timeAgo(rejection.created_at)}
                    </p>
                  </>
                ) : null}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
