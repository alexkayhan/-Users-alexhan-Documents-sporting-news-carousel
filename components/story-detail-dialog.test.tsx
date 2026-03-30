import React, { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StoryDetailDialog } from "@/components/story-detail-dialog";

const story = {
  id: "story-1",
  headline: "Playoff race tightens after late winner",
  summary: "The final shot dropped with less than a second remaining.",
  content: "The full recap breaks down the final possession and postgame reaction.",
  source: "AP Sports",
  author: "Jordan Ellis",
  publishedAt: "2026-03-27T10:30:00Z",
  tag: "Basketball" as const,
  url: "https://example.com/story-1",
  image: {
    src: "/mock-images/basketball-buzzer.svg",
    alt: "Playoff race tightens after late winner",
    fallbackSrc: "/mock-images/basketball-buzzer.svg",
  },
};

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open story
      </button>
      {isOpen ? (
        <StoryDetailDialog
          story={story}
          isBookmarked={false}
          onClose={() => setIsOpen(false)}
          onToggleBookmark={vi.fn()}
        />
      ) : null}
    </>
  );
}

describe("StoryDetailDialog", () => {
  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();

    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open story" }));

    expect(
      screen.getByRole("button", { name: "Close story details" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Open story" })).toHaveFocus();
  });

  it("keeps keyboard focus trapped inside the dialog", async () => {
    const user = userEvent.setup();

    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open story" }));

    const closeButton = screen.getByRole("button", {
      name: "Close story details",
    });
    const bookmarkButton = screen.getByRole("button", {
      name: "Save bookmark",
    });
    const link = screen.getByRole("link", {
      name: "Read original story from AP Sports",
    });

    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(bookmarkButton).toHaveFocus();

    await user.tab();
    expect(link).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(link).toHaveFocus();
  });

  it("shows the source badge on fallback art and exposes the thread url inside the link", async () => {
    const user = userEvent.setup();

    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open story" }));

    expect(screen.getAllByText("AP Sports")).toHaveLength(2);
    expect(screen.getByText("https://example.com/story-1")).toBeInTheDocument();
  });
});
