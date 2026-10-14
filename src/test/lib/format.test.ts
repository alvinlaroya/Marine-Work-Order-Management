import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  firstName,
  formatDate,
  formatDateTime,
  greeting,
  initials,
  pluralize,
  timeAgo,
} from "@/lib/format";

describe("initials", () => {
  it("uses first and last name parts", () => {
    expect(initials("Sam Rivera")).toBe("SR");
    expect(initials("Ada")).toBe("A");
    expect(initials("  ")).toBe("?");
  });
});

describe("firstName", () => {
  it("returns the first token", () => {
    expect(firstName("Sam Rivera")).toBe("Sam");
  });
});

describe("pluralize", () => {
  it("chooses singular or plural labels", () => {
    expect(pluralize(1, "user")).toBe("1 user");
    expect(pluralize(2, "user")).toBe("2 users");
    expect(pluralize(3, "person", "people")).toBe("3 people");
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats recent and older timestamps", () => {
    expect(timeAgo("2026-01-15T11:59:30.000Z")).toBe("just now");
    expect(timeAgo("2026-01-15T11:00:00.000Z")).toBe("1h ago");
    expect(timeAgo("2026-01-14T12:00:00.000Z")).toBe("1d ago");
  });
});

describe("greeting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("varies by time of day", () => {
    vi.setSystemTime(new Date("2026-01-15T08:00:00"));
    expect(greeting()).toBe("Good morning");
    vi.setSystemTime(new Date("2026-01-15T14:00:00"));
    expect(greeting()).toBe("Good afternoon");
    vi.setSystemTime(new Date("2026-01-15T20:00:00"));
    expect(greeting()).toBe("Good evening");
  });
});

describe("formatDate / formatDateTime", () => {
  it("formats ISO strings", () => {
    const iso = "2026-01-15T12:00:00.000Z";
    expect(formatDate(iso)).toMatch(/2026/);
    expect(formatDateTime(iso)).toMatch(/2026/);
  });
});
