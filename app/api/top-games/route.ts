import { NextResponse } from "next/server";
import {
  TopGamesRequestError,
  fetchTopGames,
  getTopGamesDateKey,
} from "@/lib/top-games";
import type { TopGamesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

let lastSuccessfulTopGames:
  | {
      dateKey: string;
      payload: TopGamesResponse;
    }
  | null = null;

export async function GET() {
  const currentDateKey = getTopGamesDateKey();

  if (lastSuccessfulTopGames && lastSuccessfulTopGames.dateKey !== currentDateKey) {
    lastSuccessfulTopGames = null;
  }

  try {
    const payload = await fetchTopGames(10, currentDateKey);
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
      { message: "Unexpected error while loading today’s DraftKings games." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
