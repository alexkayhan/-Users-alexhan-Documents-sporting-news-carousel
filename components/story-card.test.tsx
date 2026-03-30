import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StoryCard } from "@/components/story-card";
import type { Story } from "@/lib/types";

function createVideoStory(): Story {
  return {
    id: "video-story",
    headline: "Big dunk goes viral in the top thread",
    summary: "A replay-heavy clip took over the subreddit within minutes.",
    content: "Fans are breaking down the finish angle by angle in the thread.",
    source: "r/nba",
    author: "u/highlight_bot",
    publishedAt: "2026-03-30T20:00:00.000Z",
    tag: "Basketball",
    url: "https://www.reddit.com/r/nba/comments/abc123/top_post/",
    image: {
      src: "/mock-images/basketball-buzzer.svg",
      alt: "Basketball highlight thumbnail",
      fallbackSrc: "/mock-images/basketball-buzzer.svg",
    },
    video: {
      src: "https://v.redd.it/nba-highlight/DASH_720.mp4?source=fallback",
      hlsSrc: "https://v.redd.it/nba-highlight/HLSPlaylist.m3u8?a=1777499636&v=1&f=sd",
      hasAudio: true,
    },
  };
}

describe("StoryCard video controls", () => {
  it("autoplays muted, exposes a direct story link, and lets the sound button toggle", async () => {
    render(
      <StoryCard
        story={createVideoStory()}
        index={0}
        total={1}
        isActive
        registerRef={vi.fn()}
      />,
    );

    const video = document.querySelector("video") as HTMLVideoElement | null;

    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(
      screen.getByRole("link", { name: "Big dunk goes viral in the top thread" }),
    ).toHaveAttribute(
      "href",
      "https://www.reddit.com/r/nba/comments/abc123/top_post/",
    );
    expect(
      screen.getByRole("link", { name: "Big dunk goes viral in the top thread" }),
    ).toHaveAttribute("target", "_blank");

    const soundButton = screen.getByRole("button", { name: "Turn sound on" });
    await userEvent.click(soundButton);

    expect(video?.muted).toBe(false);
    expect(
      screen.getByRole("button", { name: "Turn sound off" }),
    ).toBeInTheDocument();
  });
});
