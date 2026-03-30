import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StoryFeed } from "@/components/story-feed";
import { mockStories } from "@/data/mock-stories";

describe("StoryFeed", () => {
  it("navigates between stories with the on-screen controls", async () => {
    render(
      <StoryFeed
        stories={mockStories.slice(0, 2)}
        nextPage={null}
        hasMore={false}
        isLoadingMore={false}
        loadMoreError={null}
        onLoadMore={vi.fn()}
        onRetryLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText("Showing story 1 of 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next story" }));
    expect(screen.getByText("Showing story 2 of 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next story" }));
    expect(screen.getByText("Showing story 1 of 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous story" }));
    expect(screen.getByText("Showing story 2 of 2")).toBeInTheDocument();
  });

  it("wraps ArrowRight from the last story back to the first story", () => {
    render(
      <StoryFeed
        stories={mockStories.slice(0, 2)}
        nextPage={null}
        hasMore={false}
        isLoadingMore={false}
        loadMoreError={null}
        onLoadMore={vi.fn()}
        onRetryLoadMore={vi.fn()}
      />,
    );

    const feed = screen.getByRole("main", { name: "Sporting news feed" });

    fireEvent.keyDown(feed, { key: "ArrowRight" });
    expect(screen.getByText("Showing story 2 of 2")).toBeInTheDocument();

    fireEvent.keyDown(feed, { key: "ArrowRight" });
    expect(screen.getByText("Showing story 1 of 2")).toBeInTheDocument();
  });

  it("wraps ArrowLeft from the first story back to the last story", () => {
    render(
      <StoryFeed
        stories={mockStories.slice(0, 2)}
        nextPage={null}
        hasMore={false}
        isLoadingMore={false}
        loadMoreError={null}
        onLoadMore={vi.fn()}
        onRetryLoadMore={vi.fn()}
      />,
    );

    const feed = screen.getByRole("main", { name: "Sporting news feed" });

    fireEvent.keyDown(feed, { key: "ArrowLeft" });
    expect(screen.getByText("Showing story 2 of 2")).toBeInTheDocument();
  });

  it("moves to the next story on swipe left", () => {
    render(
      <StoryFeed
        stories={mockStories.slice(0, 3)}
        nextPage={null}
        hasMore={false}
        isLoadingMore={false}
        loadMoreError={null}
        onLoadMore={vi.fn()}
        onRetryLoadMore={vi.fn()}
      />,
    );

    const feed = screen.getByRole("main", { name: "Sporting news feed" });

    fireEvent.touchStart(feed, {
      changedTouches: [{ clientX: 240, clientY: 80 }],
    });
    fireEvent.touchEnd(feed, {
      changedTouches: [{ clientX: 120, clientY: 92 }],
    });

    expect(screen.getByText("Showing story 2 of 3")).toBeInTheDocument();
  });
});
