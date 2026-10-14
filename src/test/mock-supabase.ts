import { vi } from "vitest";

export type SupabaseMockResult = {
  data: unknown;
  error: { message: string } | null;
};

type TableHandler =
  | SupabaseMockResult
  | (() => SupabaseMockResult | Promise<SupabaseMockResult>);

function resolveHandler(handler: TableHandler | undefined): Promise<SupabaseMockResult> {
  if (!handler) {
    return Promise.resolve({ data: null, error: null });
  }
  return Promise.resolve(typeof handler === "function" ? handler() : handler);
}

function thenableChain(
  getResult: () => Promise<SupabaseMockResult>,
): Record<string, unknown> & PromiseLike<SupabaseMockResult> {
  const chain = {} as Record<string, unknown> & PromiseLike<SupabaseMockResult>;
  for (const method of ["select", "eq", "neq", "in", "order", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => getResult());
  chain.single = vi.fn(() => getResult());
  chain.then = (onFulfilled, onRejected) => getResult().then(onFulfilled, onRejected);
  return chain;
}

export interface SupabaseClientMockOptions {
  tables?: Record<string, TableHandler>;
  session?: unknown;
  rpc?: ReturnType<typeof vi.fn>;
}

export function createSupabaseClientMock(options: SupabaseClientMockOptions = {}) {
  const tables = options.tables ?? {};
  const rpc = options.rpc ?? vi.fn(async () => ({ data: null, error: null }));

  return {
    from: vi.fn((table: string) => thenableChain(() => resolveHandler(tables[table]))),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: options.session ?? { id: "anon-session" } },
        error: null,
      })),
      signInAnonymously: vi.fn(async () => ({ data: { session: { id: "anon-session" } }, error: null })),
    },
    rpc,
  };
}
