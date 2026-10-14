import { describe, expect, it } from "vitest";

import { parseSupabaseError, workOrderFormSchema } from "@/lib/validation";

describe("validation", () => {
  it("parses supabase-like errors", () => {
    expect(parseSupabaseError({ message: "Duplicate user email" })).toBe(
      "Duplicate user email",
    );
  });

  it("requires crew assignment for work orders", () => {
    const result = workOrderFormSchema.safeParse({
      title: "Fix pump",
      issue: "Pump leaking in engine room",
      assigned_crew_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the seeded crew ids, which are not strict RFC-4122 UUIDs", () => {
    const result = workOrderFormSchema.safeParse({
      title: "Fix pump",
      issue: "Pump leaking in engine room",
      assigned_crew_id: "22222222-2222-2222-2222-222222222205",
    });
    expect(result.success).toBe(true);
  });
});
