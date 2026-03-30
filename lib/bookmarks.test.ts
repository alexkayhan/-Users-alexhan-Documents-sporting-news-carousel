import { describe, expect, it, vi } from "vitest";
import {
  getBookmarkStorageKey,
  readBookmarkedStoryIds,
  writeBookmarkedStoryIds,
} from "@/lib/bookmarks";

describe("bookmark storage", () => {
  it("reads bookmark ids from localStorage", () => {
    window.localStorage.setItem(
      getBookmarkStorageKey(),
      JSON.stringify(["story-1", "story-2"]),
    );

    expect(Array.from(readBookmarkedStoryIds())).toEqual(["story-1", "story-2"]);
  });

  it("swallows storage write failures", () => {
    const setItemSpy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    expect(() => {
      writeBookmarkedStoryIds(new Set(["story-1"]));
    }).not.toThrow();

    setItemSpy.mockRestore();
  });
});
