/** Parses a 1-based page from URL search params; invalid values default to page 1. */
export function parsePage(value: string | null): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function pageBounds(
  page: number,
  pageSize: number,
  totalItems: number,
): { totalPages: number; start: number; end: number } {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return { totalPages, start, end };
}
