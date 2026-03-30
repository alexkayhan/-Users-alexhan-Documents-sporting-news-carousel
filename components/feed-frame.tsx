import type { ReactNode } from "react";

type FeedFrameProps = {
  children: ReactNode;
  counter?: string;
  eyebrow?: string;
  showHint?: boolean;
};

export function FeedFrame({
  children,
  showHint = true,
}: FeedFrameProps) {
  return (
    <div className="feed-page">
      <div className="feed-overlay" aria-hidden="true" />

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
