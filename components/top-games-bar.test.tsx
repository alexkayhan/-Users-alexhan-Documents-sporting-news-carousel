import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TopGamesResponse } from "@/lib/types";

vi.mock("@/lib/top-games", async () => {
  const actual = await vi.importActual<typeof import("@/lib/top-games")>("@/lib/top-games");

  return {
    ...actual,
    getTopGamesDateKey: vi.fn(() => "2026-03-30"),
  };
});

import { TopGamesBar } from "@/components/top-games-bar";
import { getTopGamesDateKey } from "@/lib/top-games";

const TOP_GAMES_CACHE_KEY = "top-games-cache-v1";

function buildTopGamesResponse(): TopGamesResponse {
  return {
    items: [
      {
        id: "game-1",
        league: "NBA",
        provider: "DraftKings",
        startTime: "2026-03-30T23:00:00.000Z",
        away: {
          abbreviation: "PHI",
          displayName: "Philadelphia 76ers",
          score: null,
          spread: "-2.5",
          spreadOdds: "-102",
        },
        home: {
          abbreviation: "MIA",
          displayName: "Miami Heat",
          score: null,
          spread: "+2.5",
          spreadOdds: "-118",
        },
        status: {
          state: "pre",
          detail: "Scheduled",
          shortDetail: "Scheduled",
          isComplete: false,
        },
        gameUrl: "https://sportsbook.draftkings.com/event/test/game-1",
        scoreboardUrl: "https://sportsbook.draftkings.com/live",
      },
    ],
    provider: "DraftKings",
    source: "DraftKings live sportsbook board",
    fetchedAt: "2026-03-30T20:00:00.000Z",
  };
}

describe("TopGamesBar", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getTopGamesDateKey).mockReturnValue("2026-03-30");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("reuses same-day cached games when the live board fails", async () => {
    window.localStorage.setItem(
      TOP_GAMES_CACHE_KEY,
      JSON.stringify({
        dateKey: "2026-03-30",
        payload: buildTopGamesResponse(),
      }),
    );

    fetchMock.mockRejectedValue(new Error("no live games"));

    render(<TopGamesBar />);

    expect(await screen.findByText("NBA")).toBeInTheDocument();
    expect(screen.getByText("PHI @ MIA")).toBeInTheDocument();
    expect(screen.queryByText("no live games")).not.toBeInTheDocument();
  });

  it("drops previous-day cached games after rollover", async () => {
    vi.mocked(getTopGamesDateKey).mockReturnValue("2026-03-31");

    window.localStorage.setItem(
      TOP_GAMES_CACHE_KEY,
      JSON.stringify({
        dateKey: "2026-03-30",
        payload: buildTopGamesResponse(),
      }),
    );

    fetchMock.mockRejectedValue(new Error("no live games"));

    render(<TopGamesBar />);

    await waitFor(() => {
      expect(screen.getByText("no live games")).toBeInTheDocument();
    });

    expect(screen.queryByText("PHI @ MIA")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(TOP_GAMES_CACHE_KEY)).toBeNull();
  });
});
