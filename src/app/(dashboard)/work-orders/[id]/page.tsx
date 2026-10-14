"use client";

import { ArrowLeft, FileX2, MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderHistory } from "@/components/work-orders/order-history";
import { ProgressStepper } from "@/components/work-orders/progress-stepper";
import { StatusBadge } from "@/components/work-orders/status-badge";
import {
  CaptainReview,
  CrewActions,
} from "@/components/work-orders/work-order-actions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useRejections, useWorkOrder, useWorkOrderEvents } from "@/hooks/use-work-orders";
import { formatDateTime, timeAgo } from "@/lib/format";
import { canCrewUpdateWorkOrder, canReviewWorkOrder } from "@/lib/permissions";

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link href="/work-orders">
        <ArrowLeft />
        Work orders
      </Link>
    </Button>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const workOrderId = params.id;
  const { profile } = useSessionContext();
  const orderQuery = useWorkOrder(workOrderId);
  const order = orderQuery.data ?? null;
  const rejectionsQuery = useRejections(workOrderId, order !== null);
  const eventsQuery = useWorkOrderEvents(workOrderId, order !== null);

  if (orderQuery.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <QueryError
          error={orderQuery.error}
          title="Could not load this work order"
          onRetry={() => void orderQuery.refetch()}
        />
      </div>
    );
  }

  if (orderQuery.isPending || !profile) {
    return (
      <div className="space-y-4" aria-busy="true">
        <BackLink />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <EmptyState
            icon={FileX2}
            title="Work order not available"
            description={`It may not exist, or ${profile.full_name} does not have access to its vessel. Captains and Crew can only open work orders for their own vessels.`}
            action={
              <Button asChild>
                <Link href="/work-orders">Back to work orders</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const rejections = rejectionsQuery.data ?? [];
  const latestRejection = rejections[0];
  const needsRework = order.status === "In Progress" && latestRejection !== undefined;
  const crewCanAct = canCrewUpdateWorkOrder(profile, order);
  const captainCanReview = canReviewWorkOrder(profile, order) && profile.role === "Captain";

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-sm text-muted-foreground">
                {order.work_order_number}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {order.title}
              </h1>
            </div>
            <StatusBadge status={order.status} closed={order.is_closed} />
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t pt-4 lg:grid-cols-4">
            <MetaItem label="Vessel">{order.vessel?.name ?? "—"}</MetaItem>
            <MetaItem label="Assigned crew">{order.assignee?.full_name ?? "—"}</MetaItem>
            <MetaItem label="Created by">{order.creator?.full_name ?? "—"}</MetaItem>
            <MetaItem label="Last updated">
              <span title={formatDateTime(order.updated_at)}>{timeAgo(order.updated_at)}</span>
            </MetaItem>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <ProgressStepper order={order} />
        </CardContent>
      </Card>

      {needsRework ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <MessageSquareWarning className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">
              Returned by {latestRejection.rejected_by?.full_name ?? "the Captain"} ·{" "}
              {timeAgo(latestRejection.created_at)}
            </p>
            <p className="whitespace-pre-wrap text-sm">{latestRejection.reason}</p>
            {crewCanAct ? (
              <p className="pt-1 text-xs opacity-80">
                Update the solution below and mark the work order Done again.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Issue</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
            {order.issue}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Solution</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
            {order.solution ? (
              order.solution
            ) : (
              <span className="text-muted-foreground">
                Not documented yet. The assigned crew member fills this in before
                marking the work order Done.
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {crewCanAct ? <CrewActions key={`${order.id}-${order.updated_at}`} order={order} /> : null}
      {captainCanReview ? <CaptainReview order={order} /> : null}
      {!crewCanAct && !captainCanReview && !order.is_closed ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {profile.role === "Captain"
            ? "You can attest or reject this work order once the assigned crew member marks it Done."
            : profile.role === "Admin"
              ? "Admins have read-only access to work orders. Captains and Crew move them through the lifecycle."
              : "Only the assigned crew member can update this work order."}
        </p>
      ) : null}

      <OrderHistory order={order} rejections={rejections} events={eventsQuery.data ?? []} />
    </div>
  );
}
