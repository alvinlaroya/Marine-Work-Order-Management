import {
  CheckCheck,
  ClipboardCheck,
  FilePlus2,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RejectionRow, WorkOrderEventRow, WorkOrderRow } from "@/types/database";

interface HistoryEntry {
  key: string;
  at: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  body?: string;
}

function buildHistory(
  order: WorkOrderRow,
  rejections: RejectionRow[],
  events: WorkOrderEventRow[],
): HistoryEntry[] {
  const entries: HistoryEntry[] = [
    {
      key: "created",
      at: order.created_at,
      icon: FilePlus2,
      tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
      title: `Created by ${order.creator?.full_name ?? "a Captain"}`,
      body: order.assignee ? `Assigned to ${order.assignee.full_name}` : undefined,
    },
    ...events.map((event) => {
      const actor = event.actor?.full_name ?? order.assignee?.full_name ?? "Crew";
      return event.event_type === "started"
        ? {
            key: event.id,
            at: event.created_at,
            icon: Play,
            tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
            title: `Started by ${actor}`,
            body: "Marked In Progress.",
          }
        : {
            key: event.id,
            at: event.created_at,
            icon: ClipboardCheck,
            tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
            title: `Completed by ${actor}`,
            body: event.note ? `Solution: ${event.note}` : "Marked Done.",
          };
    }),
    ...rejections.map((rejection) => ({
      key: rejection.id,
      at: rejection.created_at,
      icon: RotateCcw,
      tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      title: `Rejected by ${rejection.rejected_by?.full_name ?? "the Captain"}`,
      body: rejection.reason,
    })),
  ];

  if (order.is_closed && order.attested_at) {
    entries.push({
      key: "attested",
      at: order.attested_at,
      icon: CheckCheck,
      tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      title: `Attested by ${order.attester?.full_name ?? "the Captain"}`,
      body: "Approved and closed.",
    });
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function OrderHistory({
  order,
  rejections,
  events = [],
}: {
  order: WorkOrderRow;
  rejections: RejectionRow[];
  events?: WorkOrderEventRow[];
}) {
  const entries = buildHistory(order, rejections, events);

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
