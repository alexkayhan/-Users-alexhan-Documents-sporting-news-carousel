"use client";

import { startTransition, useEffect, useState } from "react";
import { FeedState } from "@/components/feed-state";
import { StoryFeed } from "@/components/story-feed";
import {
  readBookmarkedStoryIds,
  writeBookmarkedStoryIds,
} from "@/lib/bookmarks";
import type { StoriesResponse, Story } from "@/lib/types";

type FeedStatus = "loading" | "success" | "error";

type FeedState = {
  status: FeedStatus;
  stories: Story[];
  message: string | null;
  nextPage: number | null;
  hasMore: boolean;
  totalResults: number;
  isLoadingMore: boolean;
  loadMoreError: string | null;
};

const PAGE_SIZE = 6;
const STORIES_REQUEST_TIMEOUT_MS = 8000;
const STORIES_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STORY_TAGS = new Set([
  "Baseball",
  "Basketball",
  "Football",
  "Hockey",
  "Motorsport",
  "Track",
  "Sports",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidPublishedAt(value: unknown) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isValidStoryUrl(value: unknown) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidStoryImageUrl(value: unknown) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  if (value.startsWith("/")) {
    return true;
  }

  if (value.startsWith("data:image/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidStoryVideoUrl(value: unknown) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidOptionalStoryVideoUrl(value: unknown) {
  return value === null || value === undefined || isValidStoryVideoUrl(value);
}

function isValidStory(value: unknown): value is Story {
  if (!isRecord(value) || !isRecord(value.image)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.summary) &&
    isNonEmptyString(value.content) &&
    isNonEmptyString(value.source) &&
    (value.author === null || value.author === undefined || isNonEmptyString(value.author)) &&
    isValidPublishedAt(value.publishedAt) &&
    isNonEmptyString(value.tag) &&
    STORY_TAGS.has(value.tag) &&
    isValidStoryUrl(value.url) &&
    isValidStoryImageUrl(value.image.src) &&
    isNonEmptyString(value.image.alt) &&
    isValidStoryImageUrl(value.image.fallbackSrc) &&
    (value.video === null ||
      value.video === undefined ||
      (isRecord(value.video) &&
        isValidStoryVideoUrl(value.video.src) &&
        isValidOptionalStoryVideoUrl(value.video.hlsSrc) &&
        (value.video.hasAudio === null ||
          value.video.hasAudio === undefined ||
          typeof value.video.hasAudio === "boolean")))
  );
}

function normalizeStoriesPayload(payload: unknown): StoriesResponse {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error("Unexpected story response.");
  }

  const items = payload.items.filter(isValidStory);
  const nextPage =
    typeof payload.nextPage === "number" &&
    Number.isFinite(payload.nextPage) &&
    payload.nextPage > 0
      ? payload.nextPage
      : null;

  return {
    items,
    page:
      typeof payload.page === "number" && Number.isFinite(payload.page) && payload.page > 0
        ? payload.page
        : 1,
    pageSize:
      typeof payload.pageSize === "number" &&
      Number.isFinite(payload.pageSize) &&
      payload.pageSize > 0
        ? payload.pageSize
        : PAGE_SIZE,
    totalResults:
      typeof payload.totalResults === "number" &&
      Number.isFinite(payload.totalResults) &&
      payload.totalResults >= 0
        ? payload.totalResults
        : items.length,
    hasMore: payload.hasMore === true && nextPage !== null,
    nextPage,
  };
}

function mergeStories(existingStories: Story[], incomingStories: Story[]) {
  const seenStoryIds = new Set(existingStories.map((story) => story.id));
  const mergedStories = [...existingStories];

  for (const story of incomingStories) {
    if (seenStoryIds.has(story.id)) {
      continue;
    }

    seenStoryIds.add(story.id);
    mergedStories.push(story);
  }

  return mergedStories;
}

export function LiveStoryFeed() {
  const [state, setState] = useState<FeedState>({
    status: "loading",
    stories: [],
    message: null,
    nextPage: 1,
    hasMore: false,
    totalResults: 0,
    isLoadingMore: false,
    loadMoreError: null,
  });
  const [bookmarkedStoryIds, setBookmarkedStoryIds] = useState<Set<string>>(
    new Set(),
  );

  async function requestStories(page: number, signal?: AbortSignal) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort("timeout");
    }, STORIES_REQUEST_TIMEOUT_MS);
    const abortRequest = () => {
      controller.abort(signal?.reason);
    };

    signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      const response = await fetch(`/api/stories?page=${page}&pageSize=${PAGE_SIZE}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && isNonEmptyString(payload.message)
            ? payload.message
            : "Unable to load Reddit posts.",
        );
      }

      return normalizeStoriesPayload(payload);
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new Error(
          "Loading Reddit posts timed out. Check your connection and try again.",
        );
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortRequest);
    }
  }

  async function loadInitialStories(signal?: AbortSignal) {
    setState((current) => ({
      ...current,
      status: "loading",
      message: null,
      loadMoreError: null,
    }));

    try {
      let page = 1;
      let payload = await requestStories(page, signal);
      let initialStories = payload.items ?? [];

      while (
        initialStories.length === 0 &&
        payload.hasMore &&
        payload.nextPage
      ) {
        page = payload.nextPage;
        payload = await requestStories(page, signal);
        initialStories = mergeStories(initialStories, payload.items ?? []);
      }

      startTransition(() => {
        setState({
          status: "success",
          stories: initialStories,
          message: null,
          nextPage: payload.nextPage ?? null,
          hasMore: payload.hasMore ?? false,
          totalResults: payload.totalResults ?? initialStories.length,
          isLoadingMore: false,
          loadMoreError: null,
        });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load Reddit posts.";

      setState((current) => ({
        ...current,
        status: "error",
        stories: current.stories,
        message,
        isLoadingMore: false,
      }));
    }
  }

  async function loadMoreStories() {
    if (!state.nextPage || state.isLoadingMore) {
      return;
    }

    setState((current) => ({
      ...current,
      isLoadingMore: true,
      loadMoreError: null,
    }));

    try {
      const payload = await requestStories(state.nextPage);

      startTransition(() => {
        setState((current) => ({
          ...current,
          status: "success",
          stories: mergeStories(current.stories, payload.items ?? []),
          nextPage: payload.nextPage ?? null,
          hasMore: payload.hasMore ?? false,
          totalResults:
            payload.totalResults ?? current.totalResults ?? current.stories.length,
          isLoadingMore: false,
          loadMoreError: null,
        }));
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load additional stories.";

      setState((current) => ({
        ...current,
        isLoadingMore: false,
        loadMoreError: message,
      }));
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    void loadInitialStories(controller.signal);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadInitialStories();
    }, STORIES_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setBookmarkedStoryIds(readBookmarkedStoryIds());
  }, []);

  function toggleBookmark(storyId: string) {
    setBookmarkedStoryIds((current) => {
      const nextBookmarks = new Set(current);

      if (nextBookmarks.has(storyId)) {
        nextBookmarks.delete(storyId);
      } else {
        nextBookmarks.add(storyId);
      }

      writeBookmarkedStoryIds(nextBookmarks);
      return nextBookmarks;
    });
  }

  if (state.status === "loading" && state.stories.length === 0) {
    return (
      <FeedState
        eyebrow="Connecting To Reddit"
        title="Loading headlines"
        description="Pulling the top Reddit posts from your selected sports communities."
        counter="..."
        showSkeleton
      />
    );
  }

  if (state.status === "error" && state.stories.length === 0) {
    return (
      <FeedState
        eyebrow="Reddit Feed Unavailable"
        title="We couldn't load sports headlines"
        description={state.message ?? "Try again in a moment."}
        counter="!"
        actionLabel="Try again"
        onAction={() => {
          void loadInitialStories();
        }}
      />
    );
  }

  if (state.status === "success" && state.stories.length === 0) {
    return (
      <FeedState
        eyebrow="No Headlines"
        title="No sports stories are available right now"
        description="Reddit did not return any current top posts from the selected subreddits."
        counter="0"
        actionLabel="Refresh"
        onAction={() => {
          void loadInitialStories();
        }}
      />
    );
  }

  return (
    <StoryFeed
      stories={state.stories}
      eyebrow="Live Reddit Feed"
      bookmarkedStoryIds={bookmarkedStoryIds}
      onToggleBookmark={toggleBookmark}
      nextPage={state.nextPage}
      hasMore={state.hasMore}
      isLoadingMore={state.isLoadingMore}
      loadMoreError={state.loadMoreError}
      onLoadMore={() => {
        void loadMoreStories();
      }}
      onRetryLoadMore={() => {
        void loadMoreStories();
      }}
    />
  );
}
