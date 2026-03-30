import { describe, expect, it, vi } from "vitest";
import { mockStories } from "@/data/mock-stories";
import {
  NewsApiRequestError,
  buildMockStoriesResponse,
  fetchSportsStories,
  inferStoryTag,
  normalizeStoryUrl,
  sanitizeContent,
  sanitizeSummary,
} from "@/lib/news-api";

function createRedditListing({
  author = "boxscore_bot",
  comments = 91,
  createdUtc = 1_774_644_800,
  domain = "self.nfl",
  imageUrl = "https://preview.redd.it/nfl-top.jpg?width=1080&format=pjpg&auto=webp&s=abc",
  isVideo = false,
  permalink = "/r/nfl/comments/abc123/top_post/",
  postUrl = "https://www.reddit.com/r/nfl/comments/abc123/top_post/",
  score = 2400,
  selftext = "Quarter-by-quarter breakdown from the top thread.",
  subreddit = "nfl",
  thumbnail = "https://b.thumbs.redditmedia.com/thumb.jpg",
  title = "Top post from the subreddit",
  videoUrl = null,
  videoHasAudio = null,
  videoHlsUrl = null,
}: {
  author?: string;
  comments?: number;
  createdUtc?: number;
  domain?: string;
  imageUrl?: string | null;
  isVideo?: boolean;
  permalink?: string;
  postUrl?: string;
  score?: number;
  selftext?: string;
  subreddit?: string;
  thumbnail?: string | null;
  title?: string;
  videoUrl?: string | null;
  videoHasAudio?: boolean | null;
  videoHlsUrl?: string | null;
} = {}) {
  return {
    data: {
      children: [
        {
          data: {
            author,
            created_utc: createdUtc,
            domain,
            is_video: isVideo,
            media: videoUrl
              ? {
                  reddit_video: {
                    fallback_url: videoUrl,
                    has_audio: videoHasAudio,
                    hls_url: videoHlsUrl,
                  },
                }
              : null,
            num_comments: comments,
            permalink,
            preview: imageUrl
              ? {
                  images: [
                    {
                      source: {
                        url: imageUrl,
                      },
                    },
                  ],
                }
              : null,
            score,
            secure_media: videoUrl
              ? {
                  reddit_video: {
                    fallback_url: videoUrl,
                    has_audio: videoHasAudio,
                    hls_url: videoHlsUrl,
                  },
                }
              : null,
            selftext,
            stickied: false,
            subreddit,
            thumbnail,
            title,
            url: postUrl,
          },
        },
      ],
    },
  };
}

describe("sanitizeSummary", () => {
  it("normalizes whitespace from reddit text", () => {
    expect(sanitizeSummary("  Big   game \n\n thread  ")).toBe("Big game thread");
  });

  it("returns a reddit fallback when text is missing", () => {
    expect(sanitizeSummary(null)).toBe("Top discussion on Reddit right now.");
  });
});

describe("sanitizeContent", () => {
  it("returns a reddit fallback when content is missing", () => {
    expect(sanitizeContent("")).toBe("Open the Reddit thread for the full discussion.");
  });
});

describe("inferStoryTag", () => {
  it("detects football and basketball reddit headlines", () => {
    expect(
      inferStoryTag({
        title: "NFL playoff picture after the late touchdown",
        description: null,
      }),
    ).toBe("Football");

    expect(
      inferStoryTag({
        title: "College basketball upset flips the bracket",
        description: null,
      }),
    ).toBe("Basketball");
  });
});

describe("normalizeStoryUrl", () => {
  it("strips hash fragments and tracking params", () => {
    expect(
      normalizeStoryUrl(
        "https://www.reddit.com/r/nfl/comments/abc123/top_post/?utm_source=share#comments",
      ),
    ).toBe("https://www.reddit.com/r/nfl/comments/abc123/top_post/");
  });

  it("rejects non-http urls", () => {
    expect(normalizeStoryUrl("javascript:alert('xss')")).toBeNull();
  });
});

describe("buildMockStoriesResponse", () => {
  it("still paginates local mock stories", () => {
    const firstPage = buildMockStoriesResponse({ page: 1, pageSize: 3 });
    const secondPage = buildMockStoriesResponse({ page: 2, pageSize: 3 });

    expect(firstPage.items).toEqual(mockStories.slice(0, 3));
    expect(firstPage.totalResults).toBe(mockStories.length);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextPage).toBe(2);

    expect(secondPage.items).toEqual(mockStories.slice(3, 6));
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextPage).toBeNull();
  });
});

describe("fetchSportsStories", () => {
  it("returns one top post per requested subreddit in order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              subreddit: "nfl",
              title: "r/nfl top post",
              permalink: "/r/nfl/comments/1/top_post/",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              subreddit: "nba",
              title: "r/nba top post",
              permalink: "/r/nba/comments/2/top_post/",
              selftext: "NBA thread details.",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              subreddit: "baseball",
              title: "r/baseball top post",
              permalink: "/r/baseball/comments/3/top_post/",
              selftext: "",
              domain: "mlb.com",
              imageUrl: null,
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              subreddit: "hockey",
              title: "r/hockey top post",
              permalink: "/r/hockey/comments/4/top_post/",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              subreddit: "cfb",
              title: "r/cfb top post",
              permalink: "/r/cfb/comments/5/top_post/",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              subreddit: "collegebasketball",
              title: "r/collegebasketball top post",
              permalink: "/r/collegebasketball/comments/6/top_post/",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items).toHaveLength(6);
    expect(payload.totalResults).toBe(6);
    expect(payload.hasMore).toBe(false);
    expect(payload.items.map((story) => story.source)).toEqual([
      "r/nfl",
      "r/nba",
      "r/baseball",
      "r/hockey",
      "r/cfb",
      "r/collegebasketball",
    ]);
    expect(payload.items[2]).toMatchObject({
      source: "r/baseball",
      tag: "Baseball",
      summary: "2,400 upvotes and 91 comments on r/baseball.",
      content:
        "Top link post from r/baseball, currently pointing to mlb.com. Open the Reddit thread to read the discussion.",
    });
    expect(payload.items[2].image.src).toBe(
      "https://b.thumbs.redditmedia.com/thumb.jpg",
    );
    expect(payload.items[2].image.fallbackSrc).toBe("/mock-images/baseball-grand-slam.svg");
    expect(payload.items[4].tag).toBe("Football");
    expect(payload.items[0].image.src).toBe(
      "https://preview.redd.it/nfl-top.jpg?width=1080&format=pjpg&auto=webp&s=abc",
    );
  });

  it("uses a direct post image url when reddit preview data is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              imageUrl: null,
              permalink: "/r/nfl/comments/1/top_post/",
              postUrl: "https://i.redd.it/nfl-highlight-photo.jpg",
              subreddit: "nfl",
              title: "r/nfl top post",
              thumbnail: "self",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify(createRedditListing()),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items[0].image.src).toBe(
      "https://i.redd.it/nfl-highlight-photo.jpg",
    );
  });

  it("maps reddit-hosted videos into the story media payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              isVideo: true,
              permalink: "/r/nba/comments/1/top_post/",
              subreddit: "nba",
              title: "r/nba top video post",
              videoHasAudio: true,
              videoHlsUrl:
                "https://v.redd.it/nba-highlight/HLSPlaylist.m3u8?a=1777499636&v=1&f=sd",
              videoUrl:
                "https://v.redd.it/nba-highlight/DASH_720.mp4?source=fallback",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify(createRedditListing()),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items[0].video).toEqual({
      hasAudio: true,
      hlsSrc: "https://v.redd.it/nba-highlight/HLSPlaylist.m3u8?a=1777499636&v=1&f=sd",
      src: "https://v.redd.it/nba-highlight/DASH_720.mp4?source=fallback",
    });
    expect(payload.items[0].image.src).toBe(
      "https://preview.redd.it/nfl-top.jpg?width=1080&format=pjpg&auto=webp&s=abc",
    );
  });

  it("falls back to the sport image when no usable reddit image exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createRedditListing({
              imageUrl: null,
              permalink: "/r/hockey/comments/1/top_post/",
              postUrl: "https://www.reddit.com/r/hockey/comments/1/top_post/",
              subreddit: "hockey",
              thumbnail: "self",
              title: "r/hockey top post",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify(createRedditListing()),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items[3].source).toBe("r/hockey");
    expect(payload.items[3].image.src).toBe("/mock-images/hockey-glove-save.svg");
    expect(payload.items[3].image.fallbackSrc).toBe(
      "/mock-images/hockey-glove-save.svg",
    );
  });

  it("turns timed out reddit requests into a request error", async () => {
    const timeoutError = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    await expect(fetchSportsStories()).rejects.toMatchObject({
      message: "Reddit timed out while loading top posts.",
      status: 504,
    } satisfies Partial<NewsApiRequestError>);
  });

  it("keeps all subreddit slots by filling failed sources with a fallback card", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/r/hockey/")) {
        throw new Error("network failed");
      }

      const subreddit = [
        "nfl",
        "nba",
        "baseball",
        "cfb",
        "collegebasketball",
      ].find((candidate) => url.includes(`/r/${candidate}/`));

      if (!subreddit) {
        throw new Error(`Unexpected URL: ${url}`);
      }

      return new Response(
        JSON.stringify(
          createRedditListing({
            subreddit,
            title: `r/${subreddit} top post`,
            permalink: `/r/${subreddit}/comments/test/top_post/`,
          }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items).toHaveLength(6);
    expect(payload.items.map((story) => story.source)).toEqual([
      "r/nfl",
      "r/nba",
      "r/baseball",
      "r/hockey",
      "r/cfb",
      "r/collegebasketball",
    ]);
    expect(payload.items[3]).toMatchObject({
      source: "r/hockey",
      tag: "Hockey",
      url: "https://www.reddit.com/r/hockey/",
    });
    expect(payload.items[3].headline).toContain("r/hockey");
  });
});
