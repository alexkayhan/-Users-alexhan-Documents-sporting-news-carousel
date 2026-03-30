"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Story } from "@/lib/types";
import { FeedFrame } from "@/components/feed-frame";
import { StoryCard } from "@/components/story-card";

type StoryFeedProps = {
  stories: Story[];
  eyebrow?: string;
  bookmarkedStoryIds: Set<string>;
  onToggleBookmark: (storyId: string) => void;
  nextPage: number | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void;
  onRetryLoadMore: () => void;
};

type CarouselPresentation = {
  blur: string;
  opacity: number;
  rotate: string;
  scale: number;
  translateX: string;
  translateY: string;
  translateZ: string;
  zIndex: number;
};

const SWIPE_THRESHOLD_PX = 48;
const MAX_VISIBLE_OFFSET = 3;

const LINEAR_CAROUSEL_PRESETS: Record<
  number,
  Omit<CarouselPresentation, "translateX" | "rotate">
> = {
  0: {
    blur: "0px",
    opacity: 1,
    scale: 1,
    translateY: "0rem",
    translateZ: "0rem",
    zIndex: 40,
  },
  1: {
    blur: "0px",
    opacity: 0.72,
    scale: 0.86,
    translateY: "0.85rem",
    translateZ: "0rem",
    zIndex: 30,
  },
  2: {
    blur: "1.25px",
    opacity: 0.34,
    scale: 0.64,
    translateY: "2rem",
    translateZ: "0rem",
    zIndex: 20,
  },
  3: {
    blur: "2.6px",
    opacity: 0.1,
    scale: 0.48,
    translateY: "3rem",
    translateZ: "0rem",
    zIndex: 10,
  },
};

function getWrappedStoryIndex(nextIndex: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  if (nextIndex < 0) {
    return total - 1;
  }

  if (nextIndex >= total) {
    return 0;
  }

  return nextIndex;
}

function getCircularOffset(index: number, activeIndex: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  let offset = index - activeIndex;
  const half = total / 2;

  if (offset > half) {
    offset -= total;
  } else if (offset < -half) {
    offset += total;
  }

  return offset;
}

function getLinearCarouselPresentation(offset: number): CarouselPresentation {
  const clampedOffset = Math.max(
    -MAX_VISIBLE_OFFSET,
    Math.min(MAX_VISIBLE_OFFSET, offset),
  );
  const absoluteOffset = Math.abs(clampedOffset);
  const direction = clampedOffset < 0 ? -1 : 1;
  const preset = LINEAR_CAROUSEL_PRESETS[absoluteOffset];

  if (absoluteOffset === 0) {
    return {
      ...preset,
      rotate: "0deg",
      translateX: "0rem",
    };
  }

  const translateXValues = [
    "",
    "clamp(8rem, 33vw, 16rem)",
    "clamp(13.5rem, 58vw, 29rem)",
    "clamp(17rem, 82vw, 40rem)",
  ];
  const rotationValues = ["", "28deg", "44deg", "58deg"];

  return {
    ...preset,
    rotate:
      direction > 0
        ? `-${rotationValues[absoluteOffset]}`
        : rotationValues[absoluteOffset],
    translateX:
      direction > 0
        ? translateXValues[absoluteOffset]
        : `calc(${translateXValues[absoluteOffset]} * -1)`,
  };
}

function getRingCarouselPresentation(
  offset: number,
  total: number,
): CarouselPresentation {
  const clampedOffset = Math.max(
    -MAX_VISIBLE_OFFSET,
    Math.min(MAX_VISIBLE_OFFSET, offset),
  );

  if (clampedOffset === 0) {
    return {
      blur: "0px",
      opacity: 1,
      rotate: "0deg",
      scale: 1,
      translateX: "0rem",
      translateY: "0rem",
      translateZ: "0rem",
      zIndex: 100,
    };
  }

  const absoluteOffset = Math.abs(clampedOffset);
  const direction = clampedOffset < 0 ? -1 : 1;
  const ringPresets: Record<
    number,
    Omit<CarouselPresentation, "rotate" | "translateX">
  > = {
    1: {
      blur: "0.35px",
      opacity: 0.88,
      scale: 0.92,
      translateY: "0.35rem",
      translateZ: "calc(-1 * clamp(1.5rem, 3vw, 2.5rem))",
      zIndex: 82,
    },
    2: {
      blur: "1.9px",
      opacity: 0.38,
      scale: 0.74,
      translateY: "1rem",
      translateZ: "calc(-1 * clamp(6rem, 10vw, 8rem))",
      zIndex: 60,
    },
    3: {
      blur: "3.4px",
      opacity: 0.16,
      scale: 0.58,
      translateY: "1.7rem",
      translateZ: "calc(-1 * clamp(10rem, 14vw, 12rem))",
      zIndex: 42,
    },
  };
  const rotateValues = ["", "26deg", "42deg", "54deg"];
  const translateXValues = [
    "",
    "clamp(15rem, 30vw, 18rem)",
    "clamp(21rem, 43vw, 28rem)",
    "clamp(27rem, 55vw, 35rem)",
  ];
  const preset = ringPresets[absoluteOffset] ?? ringPresets[3];

  return {
    ...preset,
    rotate:
      direction > 0
        ? `-${rotateValues[absoluteOffset]}`
        : rotateValues[absoluteOffset],
    translateX:
      direction > 0
        ? translateXValues[absoluteOffset]
        : `calc(${translateXValues[absoluteOffset]} * -1)`,
  };
}

function getCarouselPresentation(
  offset: number,
  total: number,
): CarouselPresentation {
  if (total >= 4) {
    return getRingCarouselPresentation(offset, total);
  }

  return getLinearCarouselPresentation(offset);
}

export function StoryFeed({
  stories,
  eyebrow = "Top Sports Headlines",
  bookmarkedStoryIds,
  onToggleBookmark,
  nextPage,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onRetryLoadMore,
}: StoryFeedProps) {
  const feedRef = useRef<HTMLElement | null>(null);
  const requestedPageRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const storyRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isDialogOpen = false;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(stories.length - 1, 0)));
    storyRefs.current = storyRefs.current.slice(0, stories.length);
  }, [stories.length]);

  useEffect(() => {
    if (
      !hasMore ||
      !nextPage ||
      isLoadingMore ||
      loadMoreError ||
      stories.length === 0
    ) {
      return;
    }

    const triggerIndex = Math.max(stories.length - 2, 0);

    if (activeIndex < triggerIndex) {
      return;
    }

    if (requestedPageRef.current === nextPage) {
      return;
    }

    requestedPageRef.current = nextPage;
    onLoadMore();
  }, [
    activeIndex,
    hasMore,
    isLoadingMore,
    loadMoreError,
    nextPage,
    onLoadMore,
    stories.length,
  ]);

  useEffect(() => {
    if (isLoadingMore) {
      return;
    }

    if (loadMoreError || !nextPage) {
      requestedPageRef.current = null;
    }
  }, [isLoadingMore, loadMoreError, nextPage]);

  function goToStory(nextIndex: number, wrap = false) {
    const targetIndex = wrap
      ? getWrappedStoryIndex(nextIndex, stories.length)
      : Math.min(Math.max(nextIndex, 0), stories.length - 1);

    setActiveIndex(targetIndex);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown" ||
      event.key === "PageDown"
    ) {
      event.preventDefault();
      goToStory(activeIndex + 1, true);
      return;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp" ||
      event.key === "PageUp"
    ) {
      event.preventDefault();
      goToStory(activeIndex - 1, true);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      goToStory(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      goToStory(stories.length - 1);
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX === null || startY === null) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0) {
      goToStory(activeIndex + 1, true);
      return;
    }

    goToStory(activeIndex - 1, true);
  }

  return (
    <FeedFrame
      counter={`${activeIndex + 1}/${stories.length}`}
      eyebrow={eyebrow}
      showHint={false}
      isDialogOpen={isDialogOpen}
    >
      <p
        id="feed-instructions"
        className="sr-only"
        aria-hidden={isDialogOpen || undefined}
      >
        Horizontal sporting news carousel. Swipe left or right to rotate
        through stories. Use the left and right arrow keys, Page Up, Page Down,
        Home, and End when the carousel is focused.
      </p>

      <p
        className="sr-only"
        aria-live="polite"
        aria-hidden={isDialogOpen || undefined}
      >
        Showing story {activeIndex + 1} of {stories.length}
      </p>

      <p
        className="sr-only"
        aria-live="polite"
        aria-hidden={isDialogOpen || undefined}
      >
        {isLoadingMore
          ? "Loading more sports stories."
          : loadMoreError
            ? "Could not load additional stories."
            : null}
      </p>

      <main
        ref={feedRef}
        className="feed-shell"
        tabIndex={isDialogOpen ? -1 : 0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Sporting news feed"
        aria-describedby="feed-instructions"
        aria-hidden={isDialogOpen || undefined}
      >
        <div className="feed-shell__orbit" aria-hidden="true" />

        {stories.map((story, index) => {
          const offset = getCircularOffset(index, activeIndex, stories.length);
          const presentation = getCarouselPresentation(offset, stories.length);
          const isVisible = Math.abs(offset) <= MAX_VISIBLE_OFFSET;
          const isInteractive = offset === 0;

          return (
            <StoryCard
              key={story.id}
              story={story}
              index={index}
              total={stories.length}
              isActive={isInteractive}
              isBookmarked={bookmarkedStoryIds.has(story.id)}
              isInteractive={isInteractive}
              onSelectStory={() => goToStory(index)}
              onToggleBookmark={onToggleBookmark}
              registerRef={(element) => {
                storyRefs.current[index] = element;
              }}
              style={{
                "--carousel-blur": presentation.blur,
                "--carousel-opacity": String(presentation.opacity),
                "--carousel-rotate": presentation.rotate,
                "--carousel-scale": String(presentation.scale),
                "--carousel-translate-x": presentation.translateX,
                "--carousel-translate-y": presentation.translateY,
                "--carousel-translate-z": presentation.translateZ,
                "--carousel-z-index": String(presentation.zIndex),
                visibility: isVisible ? "visible" : "hidden",
              } as CSSProperties}
            />
          );
        })}
      </main>

      {isLoadingMore ? (
        <div className="feed-status" aria-hidden="true">
          Loading more stories
        </div>
      ) : null}

      {!isDialogOpen ? (
        <div className="feed-controls" role="group" aria-label="Story navigation">
          <button
            type="button"
            className="feed-controls__button"
            onClick={() => goToStory(activeIndex - 1, true)}
            disabled={stories.length <= 1}
            aria-label="Previous story"
          >
            ←
          </button>

          <button
            type="button"
            className="feed-controls__button"
            onClick={() => goToStory(activeIndex + 1, true)}
            disabled={stories.length <= 1}
            aria-label="Next story"
          >
            →
          </button>
        </div>
      ) : null}

      {loadMoreError && !isDialogOpen ? (
        <button
          type="button"
          className="feed-status feed-status--button"
          onClick={onRetryLoadMore}
        >
          Retry loading more
        </button>
      ) : null}
    </FeedFrame>
  );
}
