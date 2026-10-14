"use client";

import { ChevronRight, ClipboardList, SearchX, ShipWheel } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { QueryError } from "@/components/common/query-error";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateWorkOrderDialog } from "@/components/work-orders/create-work-order-dialog";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { WorkOrderLinkRow } from "@/components/work-orders/work-order-link-row";
import { useSessionContext } from "@/hooks/use-session-context";
import { useWorkOrders } from "@/hooks/use-work-orders";
import { timeAgo } from "@/lib/format";
import {
  STATUS_TABS,
  matchesSearch,
  matchesTab,
  parseStatusTab,
  type StatusTab,
} from "@/lib/work-order-filters";
import { parsePage } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const DESCRIPTION = {
  Admin: "Every work order for the selected vessel.",
  Captain: "Work orders you manage for the selected vessel.",
  Crew: "Work orders assigned to you on the selected vessel.",
} as const;

export function WorkOrderList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile, vessel, hasVesselAccess } = useSessionContext();
  const ordersQuery = useWorkOrders();
  const [search, setSearch] = useState("");

  const tab = parseStatusTab(searchParams.get("status"));
  const orders = ordersQuery.data ?? [];

  const requestedPage = parsePage(searchParams.get("page"));

  function updateParams(update: (params: URLSearchParams) => void): void {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setPage(next: number): void {
    updateParams((params) => {
      if (next <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(next));
      }
    });
  }

  function changeTab(next: string): void {
    updateParams((params) => {
      if (next === "all") {
        params.delete("status");
      } else {
        params.set("status", next);
      }
      params.delete("page");
    });
  }

  function changeSearch(next: string): void {
    setSearch(next);
    if (searchParams.has("page")) {
      setPage(1);
    }
  }

  if (!profile) {
    return null;
  }

  const counts = Object.fromEntries(
    STATUS_TABS.map((item) => [
      item.value,
      orders.filter((order) => matchesTab(order, item.value)).length,
    ]),
  ) as Record<StatusTab, number>;

  const visible = orders.filter(
    (order) => matchesTab(order, tab) && matchesSearch(order, search),
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamp so a stale or too-large ?page= (or a shrinking list) never shows an empty page.
  const currentPage = Math.min(requestedPage, totalPages);
  const pageOrders = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const actions =
    profile.role === "Captain" && vessel ? (
      <CreateWorkOrderDialog vesselId={vessel.id} vesselName={vessel.name} />
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={vessel?.name ?? "No vessel selected"}
        title="Work orders"
        description={DESCRIPTION[profile.role]}
        actions={actions}
      />

      {!vessel ? (
        <Card>
          <EmptyState
            icon={ShipWheel}
            title="No active vessels"
            description="An Admin can create vessels under Administration, Vessels."
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Tabs value={tab} onValueChange={changeTab}>
                <TabsList>
                  {STATUS_TABS.map((item) => (
                    <TabsTrigger key={item.value} value={item.value}>
                      {item.label}
                      <span
                        className={cn(
                          "rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums",
                          tab === item.value && "bg-primary/10 text-primary",
                        )}
                      >
                        {ordersQuery.isPending ? "–" : counts[item.value]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <Input
              type="search"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search by ID, title or assignee"
              aria-label="Search work orders"
              className="lg:max-w-xs"
            />
          </div>

          {ordersQuery.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Card>
              {orders.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No work orders yet"
                  description={
                    profile.role === "Captain"
                      ? "Create the first work order for this vessel and assign it to a crew member."
                      : profile.role === "Crew"
                        ? "Nothing is assigned to you on this vessel yet."
                        : "Work orders created by the Captain will appear here."
                  }
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="No matching work orders"
                  description="Try another status tab or clear the search."
                />
              )}
            </Card>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {pageOrders.map((order) => (
                  <WorkOrderLinkRow key={order.id} order={order} />
                ))}
              </div>

              <Card className="hidden overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[42%] pl-5">Work order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned crew</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/work-orders/${order.id}`)}
                      >
                        <TableCell className="py-3 pl-5">
                          <Link
                            href={`/work-orders/${order.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="block rounded font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {order.title}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{order.work_order_number}</span>
                            <span className="line-clamp-1">{order.issue}</span>
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} closed={order.is_closed} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.assignee?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {timeAgo(order.updated_at)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={visible.length}
                onPageChange={setPage}
                itemLabel="work order"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
