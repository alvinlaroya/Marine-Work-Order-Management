/** Keeps the first row per work order id (caller should pass rows newest-first). */
export function latestRejectionByWorkOrder<T extends { work_order_id: string }>(
  rows: T[],
): Record<string, T> {
  const latest: Record<string, T> = {};
  for (const row of rows) {
    latest[row.work_order_id] ??= row;
  }
  return latest;
}
