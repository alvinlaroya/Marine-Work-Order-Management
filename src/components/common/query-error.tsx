"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parseSupabaseError } from "@/lib/validation";

interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
  title?: string;
}

export function QueryError({
  error,
  onRetry,
  title = "Something went wrong",
}: QueryErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
    >
      <TriangleAlert className="size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {parseSupabaseError(error)}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
