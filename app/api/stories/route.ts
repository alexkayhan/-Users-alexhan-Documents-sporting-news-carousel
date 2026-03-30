import { NextResponse } from "next/server";
import {
  NewsApiRequestError,
  fetchSportsStories,
} from "@/lib/news-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const page = Math.max(1, Number(requestUrl.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    10,
    Math.max(1, Number(requestUrl.searchParams.get("pageSize") ?? "5") || 5),
  );

  try {
    const stories = await fetchSportsStories({ page, pageSize });

    return NextResponse.json(stories);
  } catch (error) {
    if (error instanceof NewsApiRequestError) {
      return NextResponse.json(
        { message: error.message },
        {
          status: error.status,
        },
      );
    }

    return NextResponse.json(
      { message: "Unexpected error while loading ESPN headlines." },
      {
        status: 500,
      },
    );
  }
}
