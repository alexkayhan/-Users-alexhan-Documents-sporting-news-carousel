const BOOKMARK_STORAGE_KEY = "sporting-news-bookmarks";

export function getBookmarkStorageKey() {
  return BOOKMARK_STORAGE_KEY;
}

export function readBookmarkedStoryIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const rawValue = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);

    if (!rawValue) {
      return new Set<string>();
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return new Set<string>();
    }

    return new Set(
      parsedValue.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set<string>();
  }
}

export function writeBookmarkedStoryIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      BOOKMARK_STORAGE_KEY,
      JSON.stringify(Array.from(ids.values())),
    );
  } catch {
    // Ignore storage write failures so bookmarking never breaks the feed UI.
  }
}
