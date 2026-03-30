"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatTopGameStartTime,
  formatScoreSummary,
  formatSpreadSummary,
  getTopGameLink,
  isValidTopGamesResponse,
  shouldShowFinalScore,
} from "@/lib/top-games";
import type { TopGame } from "@/lib/types";

type TopGamesBarState = {
  status: "loading" | "success" | "error";
  items: TopGame[];
  message: string | null;
};

const TOP_GAMES_REFRESH_INTERVAL_MS = 60_000;
const TOP_GAMES_REQUEST_TIMEOUT_MS = 8_000;

function buildAccessibleGameLabel(game: TopGame) {
  const baseLabel = `${game.league}. ${game.away.displayName} at ${game.home.displayName}. ${formatSpreadSummary(game)}.`;

  if (game.status.state === "pre") {
    return `${baseLabel} Starts at ${formatTopGameStartTime(game.startTime)}.`;
  }

  if (game.status.state === "post") {
    return `${baseLabel} Final. ${game.away.displayName} ${game.away.score ?? "0"}, ${game.home.displayName} ${game.home.score ?? "0"}.`;
  }

  return `${baseLabel} ${game.status.shortDetail}. Score ${game.away.score ?? "0"} to ${game.home.score ?? "0"}.`;
}

function GameChip({
  game,
}: {
  game: TopGame;
}) {
  const href = getTopGameLink(game);
  const scoreSummary = formatScoreSummary(game);
  const statusText =
    game.status.state === "pre" ? "Start" : game.status.shortDetail;
  const valueText =
    game.status.state === "pre"
      ? formatTopGameStartTime(game.startTime)
      : scoreSummary;
  const isFinal = shouldShowFinalScore(game);
  const label = buildAccessibleGameLabel(game);

  const content = (
    <>
      <div className="top-game-chip__content">
        <p className="top-game-chip__league">{game.league}</p>
        <p className="top-game-chip__teams">
          {game.away.abbreviation} @ {game.home.abbreviation}
        </p>
        <p className="top-game-chip__spread">{formatSpreadSummary(game)}</p>
      </div>

      <div
        className={`top-game-chip__scoreboard${
          isFinal ? " top-game-chip__scoreboard--final" : ""
        }`}
      >
        <span className="top-game-chip__score-status">{isFinal ? "F" : statusText}</span>
        <span className="top-game-chip__score-value">{valueText}</span>
      </div>
    </>
  );

  if (!href) {
    return (
      <article className="top-game-chip" aria-label={label}>
        {content}
      </article>
    );
  }

  return (
    <a
      className="top-game-chip top-game-chip--link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
    >
      {content}
    </a>
  );
}

export function TopGamesBar() {
  const [state, setState] = useState<TopGamesBarState>({
    status: "loading",
    items: [],
    message: null,
  });

  useEffect(() => {
    let ignore = false;

    async function loadTopGames() {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort("timeout");
      }, TOP_GAMES_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch("/api/top-games", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(
            typeof payload === "object" &&
              payload !== null &&
              "message" in payload &&
              typeof payload.message === "string"
              ? payload.message
              : "Unable to load the DraftKings games board.",
          );
        }

        if (!isValidTopGamesResponse(payload)) {
          throw new Error("Unable to read the DraftKings games board.");
        }

        if (ignore) {
          return;
        }

        setState({
          status: "success",
          items: payload.items,
          message: null,
        });
      } catch (error) {
        if (ignore) {
          return;
        }

        const message =
          controller.signal.aborted && !ignore
            ? "DraftKings board timed out."
            : error instanceof Error
              ? error.message
              : "Unable to load the DraftKings games board.";

        setState((current) => ({
          status: current.items.length > 0 ? "success" : "error",
          items: current.items,
          message,
        }));
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void loadTopGames();
    const intervalId = window.setInterval(loadTopGames, TOP_GAMES_REFRESH_INTERVAL_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const loadingItems = useMemo(() => Array.from({ length: 5 }), []);

  return (
    <section className="top-games-bar" aria-label="Top DraftKings games">
      <div className="top-games-bar__inner">
        <div className="top-games-bar__title">
          <p className="top-games-bar__eyebrow">Top DraftKings Games</p>
          <p className="top-games-bar__subcopy">via ESPN live odds board</p>
        </div>

        <div className="top-games-bar__rail">
          {state.status === "loading" ? (
            <div className="top-games-bar__items" aria-hidden="true">
              {loadingItems.map((_, index) => (
                <div className="top-game-chip top-game-chip--loading" key={index} />
              ))}
            </div>
          ) : state.items.length > 0 ? (
            <div className="top-games-bar__items">
              {state.items.map((game) => (
                <GameChip game={game} key={game.id} />
              ))}
            </div>
          ) : (
            <div className="top-games-bar__empty" role="status">
              {state.message ?? "DraftKings board unavailable right now."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
