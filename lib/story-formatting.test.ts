import { describe, expect, it } from "vitest";
import { formatPublishedTime } from "@/lib/story-formatting";

describe("formatPublishedTime", () => {
  it("returns a safe fallback when the date is invalid", () => {
    expect(formatPublishedTime("not-a-date")).toBe("Unknown time");
  });
});
