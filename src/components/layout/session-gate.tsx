"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionContext } from "@/hooks/use-session-context";

function setupHint(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("missing next_public_supabase")) {
    return "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.";
  }
  if (text.includes("anonymous")) {
    return "Enable Anonymous sign-ins in Supabase: Authentication, Providers (or Sign In / Providers), Anonymous.";
  }
  if (text.includes("relation") || text.includes("schema cache")) {
    return "The database tables were not found. Run supabase/schema.sql, then supabase/seed.sql.";
  }
  return "Check your Supabase URL, anon key and that schema.sql has been applied.";
}

/** Renders children only once the mock session is ready; otherwise explains what is missing. */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { status, error } = useSessionContext();
  const queryClient = useQueryClient();

  if (status === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading session">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <Card className="mx-auto mt-8 max-w-xl">
        <EmptyState
          icon={TriangleAlert}
          title="Could not connect to Supabase"
          description={
            <>
              <span className="block font-mono text-xs text-destructive">
                {error}
              </span>
              <span className="mt-2 block">{setupHint(error ?? "")}</span>
            </>
          }
          action={
            <Button onClick={() => void queryClient.invalidateQueries()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  if (status === "empty") {
    return (
      <Card className="mx-auto mt-8 max-w-xl">
        <EmptyState
          icon={DatabaseZap}
          title="No users found"
          description="The database is connected but has no active Admin. Run supabase/seed.sql to load the demo vessels, users and work orders."
          action={
            <Button onClick={() => void queryClient.invalidateQueries()}>
              Check again
            </Button>
          }
        />
      </Card>
    );
  }

  return <>{children}</>;
}
