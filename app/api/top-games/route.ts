import { NextResponse } from "next/server";
import {
  TopGamesRequestError,
  fetchTopGames,
} from "@/lib/top-games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const topGames = await fetchTopGames(5);

    return NextResponse.json(topGames, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
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
      { message: "Unexpected error while loading the DraftKings games board." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
