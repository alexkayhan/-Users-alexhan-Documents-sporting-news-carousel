import type { CSSProperties } from "react";
import { StoryImage } from "@/components/story-image";
import { formatPublishedTime } from "@/lib/story-formatting";
import type { Story } from "@/lib/types";

type StoryCardProps = {
  story: Story;
  index: number;
  total: number;
  isActive: boolean;
  isInteractive?: boolean;
  onSelectStory?: () => void;
  registerRef: (element: HTMLElement | null) => void;
  style?: CSSProperties;
};

export function StoryCard({
  story,
  index,
  total,
  isActive,
  isInteractive = true,
  onSelectStory,
  registerRef,
  style,
}: StoryCardProps) {
  const headlineId = `story-headline-${story.id}`;
  const summaryId = `story-summary-${story.id}`;
  const metaId = `story-meta-${story.id}`;
  const isFallbackImage = story.image.src === story.image.fallbackSrc;
  const hasVideo = Boolean(story.video?.src);
  const canToggleVideoAudio = hasVideo && story.video?.hasAudio !== false;

  return (
    <article
      ref={registerRef}
      className={`story-card${isActive ? " is-active" : ""}`}
      data-index={index}
      aria-labelledby={isInteractive ? headlineId : undefined}
      aria-describedby={isInteractive ? `${summaryId} ${metaId}` : undefined}
      aria-hidden={isInteractive ? undefined : true}
      style={style}
    >
      <div className="story-card__surface">
        <div className="story-card__media">
          <StoryImage
            src={story.image.src}
            fallbackSrc={story.image.fallbackSrc}
            alt={story.image.alt}
            videoSrc={story.video?.src}
            videoHlsSrc={story.video?.hlsSrc}
            videoHasAudio={story.video?.hasAudio}
            eager={index < 2}
            autoplay={isActive}
            showAudioToggle={isActive && isInteractive && canToggleVideoAudio}
            className="story-card__image"
          />
          {isFallbackImage ? (
            <span className="story-card__media-badge" aria-hidden="true">
              {story.source}
            </span>
          ) : null}
        </div>

        <div className="story-card__body">
          <span className="story-card__tag">{story.tag}</span>

          <div>
            <h2 id={headlineId} className="story-card__headline">
              {story.headline}
            </h2>
          </div>

          <p id={summaryId} className="story-card__summary">
            {story.summary}
          </p>

          <div id={metaId} className="story-card__meta">
            <span>
              Source <strong>{story.source}</strong>
            </span>
            <span aria-hidden="true">•</span>
            <time dateTime={story.publishedAt}>
              {formatPublishedTime(story.publishedAt)}
            </time>
          </div>

          <div className="story-card__progress" aria-hidden="true">
            <div className="story-card__progress-track">
              <div
                className="story-card__progress-fill"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {isInteractive ? (
          <a
            href={story.url}
            className="story-card__open"
            aria-labelledby={headlineId}
            aria-describedby={`${summaryId} ${metaId}`}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={0}
          >
            <span className="sr-only">Open original story</span>
          </a>
        ) : (
          <button
            type="button"
            className="story-card__open"
            aria-labelledby={headlineId}
            aria-describedby={`${summaryId} ${metaId}`}
            tabIndex={-1}
            onClick={() => {
              onSelectStory?.();
            }}
          >
            <span className="sr-only">Move this story into focus</span>
          </button>
        )}
      </div>
    </article>
  );
}
