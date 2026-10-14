import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Segment {
  label: string;
  value: number;
  className: string;
}

export function StatusDistribution({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status breakdown</CardTitle>
        <CardDescription>
          {total === 0 ? "No work orders yet" : `${total} work orders on this vessel`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
        >
          {segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.label}
                className={segment.className}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="space-y-2 text-sm">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${segment.className}`} />
                {segment.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {segment.value}
                {total > 0 ? ` · ${Math.round((segment.value / total) * 100)}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
