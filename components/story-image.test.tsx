import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoryImage } from "@/components/story-image";

describe("StoryImage video playback", () => {
  beforeEach(() => {
    vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue("");
  });

  it("prefers the reddit HLS stream when the browser can play it natively", async () => {
    vi.mocked(HTMLMediaElement.prototype.canPlayType).mockImplementation((value) =>
      value.includes("mpegurl") ? "probably" : "",
    );

    const { container } = render(
      <StoryImage
        src="/mock-images/football-breakaway.svg"
        fallbackSrc="/mock-images/football-breakaway.svg"
        alt="Football highlight"
        videoSrc="https://v.redd.it/clip/CMAF_720.mp4?source=fallback"
        videoHlsSrc="https://v.redd.it/clip/HLSPlaylist.m3u8?a=1777499636&v=1&f=sd"
        videoHasAudio
        autoplay
        showAudioToggle
      />,
    );

    const video = container.querySelector("video") as HTMLVideoElement | null;

    expect(video).not.toBeNull();

    await waitFor(() => {
      expect(video?.src).toContain("HLSPlaylist.m3u8");
    });
  });
});
