import { NextResponse } from "next/server";
import {
  TopGamesRequestError,
  collectCompletedTopGames,
  fetchCompletedTopGamesForDate,
  fetchTopGames,
  getTopGamesDateKey,
  mergeTopGamesWithCompleted,
} from "@/lib/top-games";
import type { TopGame, TopGamesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

let lastSuccessfulTopGames:
  | {
      dateKey: string;
      payload: TopGamesResponse;
    }
  | null = null;

let sameDayCompletedTopGames:
  | {
      dateKey: string;
      items: TopGame[];
    }
  | null = null;

export async function GET() {
  const currentDateKey = getTopGamesDateKey();

  if (lastSuccessfulTopGames && lastSuccessfulTopGames.dateKey !== currentDateKey) {
    lastSuccessfulTopGames = null;
  }

  if (sameDayCompletedTopGames && sameDayCompletedTopGames.dateKey !== currentDateKey) {
    sameDayCompletedTopGames = null;
  }

  try {
    const topGames = await fetchTopGames(10);
    const completedTopGames = await fetchCompletedTopGamesForDate(currentDateKey, 10);
    const mergedItems = mergeTopGamesWithCompleted(
      topGames.items,
      [...(sameDayCompletedTopGames?.items ?? []), ...completedTopGames],
    );
    const payload: TopGamesResponse = {
      ...topGames,
      items: mergedItems,
    };

    sameDayCompletedTopGames = {
      dateKey: currentDateKey,
      items: collectCompletedTopGames(mergedItems),
    };
    lastSuccessfulTopGames = {
      dateKey: currentDateKey,
      payload,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const completedTopGames = await fetchCompletedTopGamesForDate(currentDateKey, 10).catch(
      () => [],
    );

    if (completedTopGames.length > 0) {
      const payload: TopGamesResponse = {
        items: completedTopGames,
        provider: "DraftKings",
        source: "DraftKings live sportsbook board",
        fetchedAt: new Date().toISOString(),
      };

      sameDayCompletedTopGames = {
        dateKey: currentDateKey,
        items: collectCompletedTopGames(completedTopGames),
      };
      lastSuccessfulTopGames = {
        dateKey: currentDateKey,
        payload,
      };

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "no-store",
          "X-Top-Games-Fallback": "same-day-finals",
        },
      });
    }

    if (lastSuccessfulTopGames?.dateKey === currentDateKey) {
      return NextResponse.json(lastSuccessfulTopGames.payload, {
        headers: {
          "Cache-Control": "no-store",
          "X-Top-Games-Fallback": "same-day-snapshot",
        },
      });
    }

    if (error instanceof TopGamesRequestError) {
      return NextResponse.json(
        { message: error.message },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      { message: "Unexpected error while loading the DraftKings live board." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
