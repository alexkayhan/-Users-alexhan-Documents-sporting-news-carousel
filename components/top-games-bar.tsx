"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatTopGameStartTime,
  formatScoreSummary,
  formatSpreadSummary,
  getTopGamesDateKey,
  getTopGameLink,
  isValidTopGamesResponse,
  shouldShowFinalScore,
} from "@/lib/top-games";
import type { TopGame, TopGamesResponse } from "@/lib/types";

type TopGamesBarState = {
  status: "loading" | "success" | "error";
  items: TopGame[];
  message: string | null;
  dateKey: string | null;
};

const TOP_GAMES_REFRESH_INTERVAL_MS = 60_000;
const TOP_GAMES_REQUEST_TIMEOUT_MS = 8_000;
const TOP_GAMES_CACHE_KEY = "top-games-cache-v1";

type StoredTopGamesCache = {
  dateKey: string;
  payload: TopGamesResponse;
};

function clearTopGamesCache() {
  try {
    window.localStorage.removeItem(TOP_GAMES_CACHE_KEY);
  } catch {
    // Ignore localStorage errors and continue without cache persistence.
  }
}

function readTopGamesCache(currentDateKey = getTopGamesDateKey()) {
  try {
    const rawValue = window.localStorage.getItem(TOP_GAMES_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as StoredTopGamesCache;

    if (
      typeof parsedValue?.dateKey !== "string" ||
      !isValidTopGamesResponse(parsedValue?.payload)
    ) {
      clearTopGamesCache();
      return null;
    }

    if (parsedValue.dateKey !== currentDateKey) {
      clearTopGamesCache();
      return null;
    }

    return parsedValue;
  } catch {
    clearTopGamesCache();
    return null;
  }
}

function writeTopGamesCache(payload: TopGamesResponse, currentDateKey = getTopGamesDateKey()) {
  try {
    const storedValue: StoredTopGamesCache = {
      dateKey: currentDateKey,
      payload,
    };

    window.localStorage.setItem(TOP_GAMES_CACHE_KEY, JSON.stringify(storedValue));
  } catch {
    // Ignore localStorage errors and continue with in-memory state only.
  }
}

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
    dateKey: null,
  });
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    function updateScrollState() {
      const rail = railRef.current;

      if (!rail) {
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }

      const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
      setCanScrollLeft(rail.scrollLeft > 4);
      setCanScrollRight(maxScrollLeft - rail.scrollLeft > 4);
    }

    updateScrollState();

    const rail = railRef.current;

    if (!rail) {
      return;
    }

    rail.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [state.items.length, state.status]);

  function scrollRail(direction: "left" | "right") {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const amount = Math.max(rail.clientWidth * 0.82, 280);
    rail.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    let ignore = false;
    const initialDateKey = getTopGamesDateKey();
    const cachedTopGames = readTopGamesCache(initialDateKey);

    if (cachedTopGames) {
      setState({
        status: "success",
        items: cachedTopGames.payload.items,
        message: null,
        dateKey: cachedTopGames.dateKey,
      });
    }

    async function loadTopGames() {
      const currentDateKey = getTopGamesDateKey();

      setState((current) => {
        if (current.dateKey && current.dateKey !== currentDateKey) {
          return {
            status: "loading",
            items: [],
            message: null,
            dateKey: null,
          };
        }

        return current;
      });

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
              : "Unable to load the DraftKings live board.",
          );
        }

        if (!isValidTopGamesResponse(payload)) {
          throw new Error("Unable to read the DraftKings live board.");
        }

        if (ignore) {
          return;
        }

        writeTopGamesCache(payload, currentDateKey);
        setState({
          status: "success",
          items: payload.items,
          message: null,
          dateKey: currentDateKey,
        });
      } catch (error) {
        if (ignore) {
          return;
        }

        const message =
          controller.signal.aborted && !ignore
            ? "DraftKings live board timed out."
            : error instanceof Error
              ? error.message
              : "Unable to load the DraftKings live board.";

        const cachedTopGames = readTopGamesCache(currentDateKey);

        setState((current) => ({
          status:
            (current.items.length > 0 && current.dateKey === currentDateKey) || cachedTopGames
              ? "success"
              : "error",
          items:
            current.items.length > 0 && current.dateKey === currentDateKey
              ? current.items
              : cachedTopGames?.payload.items ?? [],
          message:
            current.items.length > 0 && current.dateKey === currentDateKey
              ? current.message
              : cachedTopGames
                ? null
                : message,
          dateKey:
            current.items.length > 0 && current.dateKey === currentDateKey
              ? current.dateKey
              : cachedTopGames?.dateKey ?? null,
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

  const loadingItems = useMemo(() => Array.from({ length: 10 }), []);

  return (
    <section className="top-games-bar" aria-label="DraftKings games today">
      <div className="top-games-bar__inner">
        <div className="top-games-bar__title">
          <p className="top-games-bar__eyebrow">DraftKings Games Today</p>
          <p className="top-games-bar__subcopy">live board plus completed games from today</p>
        </div>

        <div className="top-games-bar__rail">
          <button
            type="button"
            className="top-games-bar__scroll-button"
            aria-label="Scroll top games left"
            onClick={() => scrollRail("left")}
            disabled={!canScrollLeft}
          >
            ←
          </button>

          {state.status === "loading" ? (
            <div className="top-games-bar__items" aria-hidden="true" ref={railRef}>
              {loadingItems.map((_, index) => (
                <div className="top-game-chip top-game-chip--loading" key={index} />
              ))}
            </div>
          ) : state.items.length > 0 ? (
            <div className="top-games-bar__items" ref={railRef}>
              {state.items.map((game) => (
                <GameChip game={game} key={game.id} />
              ))}
            </div>
          ) : (
            <div className="top-games-bar__empty" role="status" ref={railRef}>
              {state.message ?? "DraftKings games are unavailable right now."}
            </div>
          )}

          <button
            type="button"
            className="top-games-bar__scroll-button"
            aria-label="Scroll top games right"
            onClick={() => scrollRail("right")}
            disabled={!canScrollRight}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
