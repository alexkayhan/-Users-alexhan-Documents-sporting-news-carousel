import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveStoryFeed } from "@/components/live-story-feed";
import { getBookmarkStorageKey } from "@/lib/bookmarks";

function createStory(id: string, headline: string) {
  return {
    id,
    headline,
    summary: "The final shot dropped with less than a second remaining.",
    content: "The full recap breaks down the final possession and postgame reaction.",
    source: "AP Sports",
    author: "Jordan Ellis",
    publishedAt: "2026-03-27T10:30:00Z",
    tag: "Basketball",
    url: `https://example.com/${id}`,
    image: {
      src: "/mock-images/basketball-buzzer.svg",
      alt: headline,
      fallbackSrc: "/mock-images/basketball-buzzer.svg",
    },
  };
}

const successPayload = {
  items: [
    createStory("story-1", "Playoff race tightens after late winner"),
  ],
  page: 1,
  pageSize: 5,
  totalResults: 1,
  hasMore: false,
  nextPage: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
  window.localStorage?.removeItem?.(getBookmarkStorageKey());
  window.history.replaceState(null, "", "/");
});

function createDeferredResponse() {
  let resolve!: (value: Response) => void;

  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("LiveStoryFeed", () => {
  it("shows an error state if the stories request times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_, options?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            },
            { once: true },
          );
        });
      }),
    );

    render(<LiveStoryFeed />);

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", {
        name: "We couldn't load sports headlines",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Loading ESPN headlines timed out. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a loading state before stories load", async () => {
    const deferred = createDeferredResponse();

    vi.stubGlobal("fetch", vi.fn(() => deferred.promise));

    render(<LiveStoryFeed />);

    expect(
      screen.getByRole("heading", { name: "Loading headlines" }),
    ).toBeInTheDocument();

    deferred.resolve(
      new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(
      await screen.findAllByRole("heading", {
        name: "Playoff race tightens after late winner",
      }),
    ).not.toHaveLength(0);
  });

  it("registers a 6 hour refresh interval for reloading ESPN headlines", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...successPayload,
            items: [createStory("story-2", "A new top thread takes over the feed")],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation(
        () => 1 as unknown as ReturnType<typeof window.setInterval>,
      );

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "Playoff race tightens after late winner",
      }),
    ).toBeInTheDocument();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      6 * 60 * 60 * 1000,
    );
  });

  it("keeps paging on initial load when the first normalized page is empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [],
            page: 1,
            pageSize: 5,
            totalResults: 3,
            hasMore: true,
            nextPage: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [createStory("story-2", "Second page provides the first usable story")],
            page: 2,
            pageSize: 5,
            totalResults: 3,
            hasMore: false,
            nextPage: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "Second page provides the first usable story",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "No sports stories are available right now",
      }),
    ).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("filters malformed stories from successful responses before rendering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "broken-story",
                headline: "Broken story",
                summary: "Missing required fields should keep this out of the feed.",
                content: "Missing required fields should keep this out of the feed.",
                source: "AP Sports",
                author: "Jordan Ellis",
                publishedAt: "not-a-date",
                tag: "Basketball",
                url: "https://example.com/broken-story",
                image: null,
              },
              createStory("story-2", "Validated story still renders"),
            ],
            page: 1,
            pageSize: 5,
            totalResults: 2,
            hasMore: false,
            nextPage: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "Validated story still renders",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Broken story",
      }),
    ).not.toBeInTheDocument();
  });

  it("filters stories with unsafe outbound urls before rendering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                ...createStory("unsafe-story", "Unsafe story"),
                url: "javascript:alert('xss')",
              },
              createStory("story-3", "Safe story still renders"),
            ],
            page: 1,
            pageSize: 5,
            totalResults: 2,
            hasMore: false,
            nextPage: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "Safe story still renders",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Unsafe story",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders stories that use generated data-url images", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                ...createStory("story-data-image", "Generated image story renders"),
                image: {
                  src: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22/%3E",
                  alt: "Generated image story renders",
                  fallbackSrc: "/mock-images/basketball-buzzer.svg",
                },
              },
            ],
            page: 1,
            pageSize: 5,
            totalResults: 1,
            hasMore: false,
            nextPage: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "Generated image story renders",
      }),
    ).toBeInTheDocument();
  });

  it("renders direct story links on the active card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<LiveStoryFeed />);

    await screen.findByRole("heading", {
      name: "Playoff race tightens after late winner",
    });

    const storyLinks = screen.getAllByRole("link", {
      name: "Playoff race tightens after late winner",
    });

    expect(storyLinks[0]).toHaveAttribute("href", "https://example.com/story-1");
    expect(storyLinks[0]).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an error state and retries successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: "ESPN RSS timed out while loading headlines." }),
          {
          status: 504,
          headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn't load sports headlines",
      }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Playoff race tightens after late winner",
        }),
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows an error state when a successful response has an invalid shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ page: 1, totalResults: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<LiveStoryFeed />);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn't load sports headlines",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Unexpected story response.")).toBeInTheDocument();
  });

  it("saves a bookmark, exposes the story link, and loads the next page", async () => {
    const pageOnePayload = {
      items: [
        createStory("story-1", "Playoff race tightens after late winner"),
        createStory("story-2", "Midfield press turns the match in second half"),
        createStory("story-3", "Closer survives bases-loaded jam in the ninth"),
      ],
      page: 1,
      pageSize: 5,
      totalResults: 4,
      hasMore: true,
      nextPage: 2,
    };

    const pageTwoPayload = {
      items: [],
      page: 2,
      pageSize: 5,
      totalResults: 4,
      hasMore: true,
      nextPage: 3,
    };

    const pageThreePayload = {
      items: [createStory("story-4", "Late scratch rewrites the starting lineup")],
      page: 3,
      pageSize: 5,
      totalResults: 4,
      hasMore: false,
      nextPage: null,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOnePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageTwoPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageThreePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<LiveStoryFeed />);

    expect(
      await screen.findAllByRole("heading", {
        name: "Playoff race tightens after late winner",
      }),
    ).not.toHaveLength(0);

    const storyLinks = screen.getAllByRole("link", {
      name: "Playoff race tightens after late winner",
    });

    const openingCard = storyLinks[0].closest("article");

    if (!openingCard) {
      throw new Error("Expected the story opener to be inside a story card.");
    }

    await userEvent.click(
      within(openingCard).getByRole("button", { name: "Save bookmark" }),
    );

    expect(
      window.localStorage.getItem(getBookmarkStorageKey()),
    ).toContain("story-1");
    expect(storyLinks[0]).toHaveAttribute("href", "https://example.com/story-1");
    expect(storyLinks[0]).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next story" }));
    await userEvent.click(screen.getByRole("button", { name: "Next story" }));
    await userEvent.click(screen.getByRole("button", { name: "Next story" }));

    expect(
      await screen.findAllByRole("heading", {
        name: "Late scratch rewrites the starting lineup",
      }),
    ).not.toHaveLength(0);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
