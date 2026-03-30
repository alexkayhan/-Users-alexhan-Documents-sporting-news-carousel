import { FeedFrame } from "@/components/feed-frame";

type FeedStateProps = {
  title: string;
  description: string;
  eyebrow: string;
  counter?: string;
  actionLabel?: string;
  onAction?: () => void;
  showSkeleton?: boolean;
};

export function FeedState({
  title,
  description,
  eyebrow,
  counter,
  actionLabel,
  onAction,
  showSkeleton = false,
}: FeedStateProps) {
  return (
    <FeedFrame counter={counter} eyebrow={eyebrow}>
      <main className="feed-state" aria-live="polite">
        <section className="feed-state__card">
          <p className="feed-state__eyebrow">{eyebrow}</p>
          <h2 className="feed-state__title">{title}</h2>
          <p className="feed-state__text">{description}</p>

          {showSkeleton ? (
            <div className="feed-state__skeleton" aria-hidden="true">
              <div className="feed-state__bar feed-state__bar--wide" />
              <div className="feed-state__bar feed-state__bar--medium" />
              <div className="feed-state__bar feed-state__bar--wide" />
              <div className="feed-state__bar feed-state__bar--short" />
            </div>
          ) : null}

          {actionLabel && onAction ? (
            <button type="button" className="feed-state__button" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </section>
      </main>
    </FeedFrame>
  );
}

