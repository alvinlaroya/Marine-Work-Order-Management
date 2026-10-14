"use client";

import {
  CheckCheck,
  CircleDot,
  ClipboardCheck,
  Hourglass,
  Loader,
  ShipWheel,
  Users,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { AdminOverview } from "@/components/dashboard/admin-overview";
import { RejectedOrdersAlert } from "@/components/dashboard/rejected-orders-alert";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusDistribution } from "@/components/dashboard/status-distribution";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkOrderDialog } from "@/components/work-orders/create-work-order-dialog";
import { WorkOrderLinkRow } from "@/components/work-orders/work-order-link-row";
import { useSessionContext } from "@/hooks/use-session-context";
import { useLatestRejections, useWorkOrders } from "@/hooks/use-work-orders";
import { firstName, greeting } from "@/lib/format";
import type { UserRole, WorkOrderRow } from "@/types/database";

const HEADER_COPY: Record<UserRole, string> = {
  Admin: "Fleet-wide view. Manage people, vessels and assignments from the sidebar.",
  Captain: "Raise work orders for your crew and review the ones they finish.",
  Crew: "Here is what is assigned to you on this vessel.",
};

const OPEN_HINT: Record<UserRole, string> = {
  Admin: "Not started yet",
  Captain: "Waiting for crew to start",
  Crew: "Ready for you to start",
};

const REVIEW_HINT: Record<UserRole, string> = {
  Admin: "Done, pending Captain review",
  Captain: "Needs your attest or reject",
  Crew: "Submitted for Captain review",
};

interface AttentionList {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: WorkOrderRow[];
  /** Show the most recent items (still ordered oldest to newest) instead of the oldest ones. */
  latest?: boolean;
}

/** Orders sorted from oldest to newest by creation time. */
function oldestFirst(orders: WorkOrderRow[]): WorkOrderRow[] {
  return [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function buildAttentionList(role: UserRole, orders: WorkOrderRow[]): AttentionList {
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

export default function DashboardPage() {
  const { profile, vessel, hasVesselAccess } = useSessionContext();
  const ordersQuery = useWorkOrders();
  const rejectionsQuery = useLatestRejections();

  if (!profile) {
    return null;
  }

  const orders = ordersQuery.data ?? [];
  const open = orders.filter((order) => order.status === "Open").length;
  const inProgress = orders.filter((order) => order.status === "In Progress").length;
  const awaiting = orders.filter(
    (order) => order.status === "Done" && !order.is_closed,
  ).length;
  const attested = orders.filter((order) => order.is_closed).length;
  // A rejected order goes back to In Progress, so those with a rejection on record
  // (and not yet resubmitted) need rework by the assigned crew member.
  const rejections = rejectionsQuery.data ?? {};
  const rejectedOrders =
    profile.role === "Crew"
      ? oldestFirst(
          orders.filter((order) => order.status === "In Progress" && rejections[order.id]),
        )
      : [];
  const attention = buildAttentionList(profile.role, orders);
  const sortedItems = oldestFirst(attention.items);
  const visibleItems = attention.latest ? sortedItems.slice(-5) : sortedItems.slice(0, 5);

  const actions =
    profile.role === "Captain" && vessel ? (
      <CreateWorkOrderDialog vesselId={vessel.id} vesselName={vessel.name} />
    ) : profile.role === "Crew" ? (
      <Button asChild>
        <Link href="/work-orders">
          <ClipboardCheck />
          My work orders
        </Link>
      </Button>
    ) : profile.role === "Admin" ? (
      <Button asChild variant="outline">
        <Link href="/admin/users">
          <Users />
          Manage users
        </Link>
      </Button>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={vessel ? vessel.name : "No vessel selected"}
        title={`${greeting()}, ${firstName(profile.full_name)}`}
        description={HEADER_COPY[profile.role]}
        actions={actions}
      />

      {profile.role === "Admin" ? <AdminOverview /> : null}

      {!vessel ? (
        <Card>
          <EmptyState
            icon={ShipWheel}
            title="No active vessels"
            description="Create a vessel under Administration, Vessels to start tracking work orders."
          />
        </Card>
      ) : !hasVesselAccess ? (
        <Card>
          <EmptyState
            icon={ShipWheel}
            title={`Not assigned to ${vessel.name}`}
            description="Captains and Crew only see work orders for vessels they are assigned to. Choose another vessel or member in the top bar."
          />
        </Card>
      ) : ordersQuery.isError ? (
        <QueryError
          error={ordersQuery.error}
          title="Could not load work orders"
          onRetry={() => void ordersQuery.refetch()}
        />
      ) : (
        <>
          <RejectedOrdersAlert orders={rejectedOrders} rejections={rejections} />

          <section
            aria-label="Work order summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {ordersQuery.isPending ? (
              Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-[116px] rounded-xl" />
              ))
            ) : (
              <>
                <StatCard
                  label="Open"
                  value={open}
                  hint={OPEN_HINT[profile.role]}
                  icon={CircleDot}
                  href="/work-orders?status=open"
                  tone="info"
                />
                <StatCard
                  label="In progress"
                  value={inProgress}
                  hint="Being worked on by crew"
                  icon={Loader}
                  href="/work-orders?status=in-progress"
                  tone="warning"
                />
                <StatCard
                  label="Awaiting review"
                  value={awaiting}
                  hint={REVIEW_HINT[profile.role]}
                  icon={Hourglass}
                  href="/work-orders?status=awaiting-review"
                  tone="violet"
                />
                <StatCard
                  label="Attested"
                  value={attested}
                  hint="Approved and closed"
                  icon={CheckCheck}
                  href="/work-orders?status=attested"
                  tone="success"
                />
              </>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{attention.title}</CardTitle>
                  <CardDescription>{attention.description}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/work-orders">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {ordersQuery.isPending ? (
                  Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-[72px] rounded-lg" />
                  ))
                ) : attention.items.length === 0 ? (
                  <EmptyState
                    icon={ClipboardCheck}
                    title={attention.emptyTitle}
                    description={attention.emptyDescription}
                    className="py-8"
                  />
                ) : (
                  visibleItems.map((order) => (
                    <WorkOrderLinkRow key={order.id} order={order} />
                  ))
                )}
              </CardContent>
            </Card>

            <StatusDistribution
              segments={[
                { label: "Open", value: open, className: "bg-sky-500" },
                { label: "In progress", value: inProgress, className: "bg-amber-500" },
                { label: "Awaiting review", value: awaiting, className: "bg-violet-500" },
                { label: "Attested", value: attested, className: "bg-emerald-500" },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
