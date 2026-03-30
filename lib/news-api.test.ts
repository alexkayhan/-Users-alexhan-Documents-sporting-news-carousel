import { describe, expect, it, vi } from "vitest";
import { mockStories } from "@/data/mock-stories";
import {
  buildMockStoriesResponse,
  fetchSportsStories,
  inferStoryTag,
  normalizeStoryUrl,
  sanitizeContent,
  sanitizeSummary,
} from "@/lib/news-api";

function createEspnItemXml({
  author = "ESPN Staff",
  description = "Latest update from the ESPN feed.",
  link = "https://www.espn.com/nfl/story/_/id/12345678/top-story",
  pubDate = "Mon, 30 Mar 2026 18:34:27 EST",
  title = "Top ESPN headline",
}: {
  author?: string | null;
  description?: string | null;
  link?: string;
  pubDate?: string;
  title?: string;
} = {}) {
  return `
    <item>
      <title><![CDATA[${title}]]></title>
      ${
        description !== null
          ? `<description><![CDATA[${description}]]></description>`
          : ""
      }
      ${author ? `<dc:creator><![CDATA[${author}]]></dc:creator>` : ""}
      <link><![CDATA[${link}]]></link>
      <pubDate>${pubDate}</pubDate>
    </item>
  `;
}

function createEspnFeedXml(itemXml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel>
        <title><![CDATA[www.espn.com - Feed]]></title>
        ${itemXml}
      </channel>
    </rss>`;
}

describe("sanitizeSummary", () => {
  it("normalizes whitespace and strips markup from ESPN text", () => {
    expect(sanitizeSummary("  Big   game <b>update</b>\n\n tonight ")).toBe(
      "Big game update tonight",
    );
  });

  it("returns an ESPN fallback when summary text is missing", () => {
    expect(sanitizeSummary(null)).toBe("Latest sports headline from ESPN.");
  });
});

describe("sanitizeContent", () => {
  it("returns an ESPN fallback when content is missing", () => {
    expect(sanitizeContent("")).toBe("Open the original ESPN story for the full article.");
  });
});

describe("inferStoryTag", () => {
  it("detects football, basketball, baseball, and hockey headlines", () => {
    expect(
      inferStoryTag({
        title: "NFL playoff picture after the late touchdown",
        description: null,
      }),
    ).toBe("Football");

    expect(
      inferStoryTag({
        title: "March Madness bracket is down to the Final Four",
        description: null,
      }),
    ).toBe("Basketball");

    expect(
      inferStoryTag({
        title: "MLB opener ends on a walk-off home run",
        description: null,
      }),
    ).toBe("Baseball");

    expect(
      inferStoryTag({
        title: "NHL overtime thriller turns on a late power play",
        description: null,
      }),
    ).toBe("Hockey");
  });
});

describe("normalizeStoryUrl", () => {
  it("strips hash fragments and tracking params", () => {
    expect(
      normalizeStoryUrl(
        "https://www.espn.com/nfl/story/_/id/12345678/top-story?utm_source=share&fbclid=test#comments",
      ),
    ).toBe("https://www.espn.com/nfl/story/_/id/12345678/top-story");
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
  it("returns one top ESPN story per configured feed in order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              author: "Courtney Cronin",
              description:
                "Colston Loveland and Tyler Warren set the bar high last year.",
              link: "https://www.espn.com/nfl/story/_/id/48313813/oregon-kenyon-sadiq",
              title:
                "Are tight ends making a first-round comeback? Why top NFL draft prospect Kenyon Sadiq could be next in line",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              author: "ESPN Staff",
              description: "The postseason teams are set and the seeding battle is on.",
              link: "https://www.espn.com/nba/story/_/id/48351111/nba-playoff-watch",
              title: "NBA playoff watch: With postseason teams set, seeding battles begin",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              author: null,
              description: "World Series contender tiers: How far away from winning it all is your favorite MLB team?",
              link: "https://www.espn.com/mlb/story/_/id/48350001/world-series-contender-tiers",
              title: "World Series contender tiers",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              description: "Guide to all 15 games on Showdown Saturday.",
              link: "https://www.espn.com/nhl/story/_/id/48350002/nhl-playoff-watch",
              title: "NHL playoff watch: Guide to all 15 games on Showdown Saturday",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              description: "Ranking college football coaches and teams that are likely to improve in 2026.",
              link: "https://www.espn.com/college-football/story/_/id/48350003/teams-likely-to-improve",
              title: "Ranking college football coaches and teams that are likely to improve in 2026",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              description: "Four teams will play for it all next weekend.",
              link: "https://www.espn.com/mens-college-basketball/story/_/id/48341549/final-four-rankings",
              title: "Men's March Madness 2026: Ranking the Final Four teams",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items).toHaveLength(6);
    expect(payload.totalResults).toBe(6);
    expect(payload.hasMore).toBe(false);
    expect(payload.items.map((story) => story.source)).toEqual([
      "ESPN NFL",
      "ESPN NBA",
      "ESPN MLB",
      "ESPN NHL",
      "ESPN College Football",
      "ESPN College Basketball",
    ]);
    expect(payload.items[0]).toMatchObject({
      source: "ESPN NFL",
      tag: "Football",
      author: "Courtney Cronin",
      summary: "Colston Loveland and Tyler Warren set the bar high last year.",
      url: "https://www.espn.com/nfl/story/_/id/48313813/oregon-kenyon-sadiq",
    });
    expect(payload.items[2]).toMatchObject({
      source: "ESPN MLB",
      tag: "Baseball",
      author: null,
    });
    expect(payload.items[3].image.src).toBe("/mock-images/hockey-glove-save.svg");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("falls back to the sport section when one ESPN feed is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              link: "https://www.espn.com/nfl/story/_/id/48313813/oregon-kenyon-sadiq",
              title: "NFL story",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response("blocked", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValue(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              link: "https://www.espn.com/mlb/story/_/id/48350001/world-series-contender-tiers",
              title: "Fallback-safe story",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items).toHaveLength(6);
    expect(payload.items[1]).toMatchObject({
      source: "ESPN NBA",
      tag: "Basketball",
      url: "https://www.espn.com/nba/",
    });
    expect(payload.items[1].headline).toContain("ESPN NBA");
  });

  it("uses the headline when the RSS item does not include a description", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              description: null,
              link: "https://www.espn.com/nfl/story/_/id/48313813/oregon-kenyon-sadiq",
              title: "Headline-only feed item",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      )
      .mockResolvedValue(
        new Response(
          createEspnFeedXml(
            createEspnItemXml({
              link: "https://www.espn.com/nba/story/_/id/48351111/nba-playoff-watch",
              title: "Other headline",
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/rss+xml" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchSportsStories({ page: 1, pageSize: 6 });

    expect(payload.items[0].summary).toBe("Headline-only feed item");
    expect(payload.items[0].content).toBe("Headline-only feed item");
  });
});
