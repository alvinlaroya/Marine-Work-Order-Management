import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { buildWorkOrderHistory } from "@/lib/order-history";
import { cn } from "@/lib/utils";
import type { RejectionRow, WorkOrderEventRow, WorkOrderRow } from "@/types/database";

export function OrderHistory({
  order,
  rejections,
  events = [],
}: {
  order: WorkOrderRow;
  rejections: RejectionRow[];
  events?: WorkOrderEventRow[];
}) {
  const entries = buildWorkOrderHistory(order, rejections, events);

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-5">
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-4 top-2 w-px -translate-x-1/2 bg-border"
          />
          {entries.map((entry) => (
            <li key={entry.key} className="relative flex gap-3">
              <span
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                  entry.tone,
                )}
              >
                <entry.icon className="size-4" />
              </span>
              <div className="min-w-0 space-y-0.5 pt-0.5">
                <p className="text-sm font-medium">{entry.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                {entry.body ? (
                  <p className="whitespace-pre-wrap pt-1 text-sm text-muted-foreground">
                    {entry.body}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
