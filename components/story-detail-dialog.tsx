"use client";

import { useEffect, useRef } from "react";
import { StoryImage } from "@/components/story-image";
import { formatPublishedTime } from "@/lib/story-formatting";
import type { Story } from "@/lib/types";

type StoryDetailDialogProps = {
  story: Story;
  isBookmarked: boolean;
  onClose: () => void;
  onToggleBookmark: (storyId: string) => void;
};

export function StoryDetailDialog({
  story,
  isBookmarked,
  onClose,
  onToggleBookmark,
}: StoryDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const titleId = `detail-title-${story.id}`;
  const summaryId = `detail-summary-${story.id}`;
  const contentId = `detail-content-${story.id}`;
  const noteId = `detail-note-${story.id}`;
  const isFallbackImage = story.image.src === story.image.fallbackSrc;
  const hasVideo = Boolean(story.video?.src);
  const canToggleVideoAudio = hasVideo && story.video?.hasAudio !== false;

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const surface = surfaceRef.current;

    if (!surface) {
      return;
    }

    const focusableElements = Array.from(
      surface.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
        ].join(","),
      ),
    ).filter((element) => !element.hasAttribute("disabled"));

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!activeElement || !surface.contains(activeElement)) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
      return;
    }

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  const contentText =
    story.content && story.content !== story.summary ? story.content : story.summary;

  return (
    <div
      className="story-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={`${summaryId} ${contentId} ${noteId}`}
      onClick={onClose}
    >
      <div
        ref={surfaceRef}
        className="story-detail__surface"
        role="document"
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="story-detail__media">
          <StoryImage
            src={story.image.src}
            fallbackSrc={story.image.fallbackSrc}
            alt={story.image.alt}
            videoSrc={story.video?.src}
            videoHlsSrc={story.video?.hlsSrc}
            videoHasAudio={story.video?.hasAudio}
            eager
            autoplay={hasVideo}
            showAudioToggle={canToggleVideoAudio}
            className="story-detail__image"
          />
          {isFallbackImage ? (
            <span className="story-detail__media-badge" aria-hidden="true">
              {story.source}
            </span>
          ) : null}
        </div>

        <div className="story-detail__body">
          <div className="story-detail__actions">
            <button
              ref={closeButtonRef}
              type="button"
              className="story-detail__icon-button"
              aria-label="Close story details"
              onClick={onClose}
            >
              Close
            </button>

            <button
              type="button"
              className={`story-detail__icon-button${
                isBookmarked ? " is-active" : ""
              }`}
              aria-pressed={isBookmarked}
              aria-label={isBookmarked ? "Remove bookmark" : "Save bookmark"}
              onClick={() => onToggleBookmark(story.id)}
            >
              {isBookmarked ? "Saved" : "Save"}
            </button>
          </div>

          <span className="story-card__tag">{story.tag}</span>

          <h2 id={titleId} className="story-detail__headline">
            {story.headline}
          </h2>

          <div className="story-detail__meta">
            <span>
              Source <strong>{story.source}</strong>
            </span>
            {story.author ? (
              <span>
                By <strong>{story.author}</strong>
              </span>
            ) : null}
            <time dateTime={story.publishedAt}>
              {formatPublishedTime(story.publishedAt)}
            </time>
          </div>

          <p id={summaryId} className="story-detail__summary">
            {story.summary}
          </p>
          <p id={contentId} className="story-detail__content">
            {contentText}
          </p>
          <p id={noteId} className="story-detail__note">
            This preview comes from the Reddit post data and may be abbreviated.
            Open the original thread for the full discussion.
          </p>

          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="story-detail__link"
            aria-label={`Read original story from ${story.source}`}
          >
            <span>Read original story</span>
            <span className="story-detail__link-url">{story.url}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
