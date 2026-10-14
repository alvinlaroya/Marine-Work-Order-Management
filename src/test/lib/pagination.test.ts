import { describe, expect, it } from "vitest";

import { pageBounds, parsePage } from "@/lib/pagination";

describe("parsePage", () => {
  it("defaults invalid values to page 1", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  it("parses positive integers", () => {
    expect(parsePage("3")).toBe(3);
  });
});

describe("pageBounds", () => {
  it("computes ranges and total pages", () => {
    expect(pageBounds(1, 10, 25)).toEqual({ totalPages: 3, start: 1, end: 10 });
    expect(pageBounds(3, 10, 25)).toEqual({ totalPages: 3, start: 21, end: 25 });
    expect(pageBounds(1, 10, 0)).toEqual({ totalPages: 1, start: 1, end: 0 });
  });
});
