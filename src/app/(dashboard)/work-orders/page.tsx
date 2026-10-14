import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { WorkOrderList } from "@/components/work-orders/work-order-list";

export const metadata: Metadata = { title: "Work orders" };

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <WorkOrderList />
    </Suspense>
  );
}
