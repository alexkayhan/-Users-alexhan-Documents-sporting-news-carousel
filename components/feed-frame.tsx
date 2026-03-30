import type { ReactNode } from "react";

type FeedFrameProps = {
  children: ReactNode;
  counter?: string;
  eyebrow?: string;
  showHint?: boolean;
  isDialogOpen?: boolean;
};

export function FeedFrame({
  children,
  counter,
  eyebrow = "Sporting News",
  showHint = true,
  isDialogOpen = false,
}: FeedFrameProps) {
  return (
    <div className="feed-page">
      <div className="feed-overlay" aria-hidden="true" />

      <header className="feed-header" aria-hidden={isDialogOpen || undefined}>
        <div className="feed-title">
          <p className="feed-eyebrow">{eyebrow}</p>
          <h1 className="feed-heading">Sporting News</h1>
        </div>

        <div className="feed-counter" aria-hidden="true">
          {counter}
        </div>
      </header>

      {children}

      {showHint ? (
        <div className="feed-hint" aria-hidden="true">
          <span>Swipe or use</span>
          <kbd>←</kbd>
          <kbd>→</kbd>
        </div>
      ) : null}
    </div>
  );
}
