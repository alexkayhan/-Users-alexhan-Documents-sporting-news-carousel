import type { StoriesResponse, Story, StoryTag } from "@/lib/types";
import { mockStories } from "@/data/mock-stories";

type RedditSourceDefinition = {
  subreddit: string;
  source: string;
  defaultTag: StoryTag;
};

type RedditListingKind = "top" | "hot";

type RedditPostData = {
  author?: string | null;
  created_utc?: number | null;
  domain?: string | null;
  is_video?: boolean | null;
  media?: {
    reddit_video?: {
      fallback_url?: string | null;
      has_audio?: boolean | null;
      hls_url?: string | null;
      is_gif?: boolean | null;
    } | null;
  } | null;
  num_comments?: number | null;
  permalink?: string | null;
  preview?: {
    images?: Array<{
      source?: {
        url?: string | null;
      } | null;
    }>;
  } | null;
  score?: number | null;
  secure_media?: {
    reddit_video?: {
      fallback_url?: string | null;
      has_audio?: boolean | null;
      hls_url?: string | null;
      is_gif?: boolean | null;
    } | null;
  } | null;
  selftext?: string | null;
  stickied?: boolean | null;
  subreddit?: string | null;
  thumbnail?: string | null;
  title?: string | null;
  url?: string | null;
};

type RedditListingResponse = {
  data?: {
    children?: Array<{
      data?: RedditPostData | null;
    }>;
  } | null;
};

const REDDIT_TOP_SOURCES: RedditSourceDefinition[] = [
  { subreddit: "nfl", source: "r/nfl", defaultTag: "Football" },
  { subreddit: "nba", source: "r/nba", defaultTag: "Basketball" },
  { subreddit: "baseball", source: "r/baseball", defaultTag: "Baseball" },
  { subreddit: "hockey", source: "r/hockey", defaultTag: "Hockey" },
  { subreddit: "cfb", source: "r/cfb", defaultTag: "Football" },
  { subreddit: "collegebasketball", source: "r/collegebasketball", defaultTag: "Basketball" },
];

const SPORT_FALLBACK_IMAGES: Record<StoryTag, string> = {
  Baseball: "/mock-images/baseball-grand-slam.svg",
  Basketball: "/mock-images/basketball-buzzer.svg",
  Football: "/mock-images/football-breakaway.svg",
  Hockey: "/mock-images/hockey-glove-save.svg",
  Motorsport: "/mock-images/motorsport-pit-stop.svg",
  Track: "/mock-images/track-photo-finish.svg",
  Sports: "/mock-images/football-breakaway.svg",
};

const TRACKING_QUERY_PARAMS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "gclsrc",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
]);

const REDDIT_REQUEST_TIMEOUT_MS = 8000;
const REDDIT_REVALIDATE_SECONDS = 6 * 60 * 60;
const REDDIT_LISTING_LIMIT = 12;
const REDDIT_LISTING_KINDS: RedditListingKind[] = ["top", "hot"];

export class NewsApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCount(value: number | null | undefined, label: string) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safeValue.toLocaleString("en-US")} ${label}`;
}

function buildRedditSummary(post: RedditPostData, source: string) {
  const selfText = normalizeText(post.selftext);

  if (selfText) {
    return selfText;
  }

  return `${formatCount(post.score, "upvotes")} and ${formatCount(
    post.num_comments,
    "comments",
  )} on ${source}.`;
}

function buildRedditContent(post: RedditPostData, source: string) {
  const selfText = normalizeText(post.selftext);

  if (selfText) {
    return selfText;
  }

  const domain = readTrimmedString(post.domain);

  if (domain && domain !== "self.Reddit") {
    return `Top link post from ${source}, currently pointing to ${domain}. Open the Reddit thread to read the discussion.`;
  }

  return `Open the Reddit thread from ${source} to read the full discussion.`;
}

function readPreviewImageUrl(post: RedditPostData) {
  const previewImageUrl = readTrimmedString(
    post.preview?.images?.[0]?.source?.url ?? null,
  );

  if (isValidHttpUrl(previewImageUrl)) {
    return previewImageUrl;
  }

  return null;
}

function isLikelyImageUrl(value: string | null | undefined) {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  return (
    /\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/.test(normalizedValue) ||
    normalizedValue.includes("i.redd.it/") ||
    normalizedValue.includes("preview.redd.it/") ||
    normalizedValue.includes("redditmedia.com/")
  );
}

function isLikelyVideoUrl(value: string | null | undefined) {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  return (
    /\.(mp4|mov|m4v|webm)(?:[?#]|$)/.test(normalizedValue) ||
    normalizedValue.includes("v.redd.it/") ||
    normalizedValue.includes("redditmedia.com/")
  );
}

function readThumbnailImageUrl(post: RedditPostData) {
  const thumbnailUrl = readTrimmedString(post.thumbnail);

  if (!thumbnailUrl) {
    return null;
  }

  const loweredThumbnailUrl = thumbnailUrl.toLowerCase();

  if (
    loweredThumbnailUrl === "self" ||
    loweredThumbnailUrl === "default" ||
    loweredThumbnailUrl === "nsfw" ||
    loweredThumbnailUrl === "spoiler"
  ) {
    return null;
  }

  if (isValidHttpUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }

  return null;
}

function readBestRedditImageUrl(post: RedditPostData) {
  const previewImageUrl = readPreviewImageUrl(post);

  if (previewImageUrl) {
    return previewImageUrl;
  }

  const directPostUrl = readTrimmedString(post.url);

  if (isLikelyImageUrl(directPostUrl)) {
    return directPostUrl;
  }

  const thumbnailUrl = readThumbnailImageUrl(post);

  if (thumbnailUrl) {
    return thumbnailUrl;
  }

  return null;
}

function readBestRedditVideoUrl(post: RedditPostData) {
  const redditVideo =
    post.secure_media?.reddit_video ?? post.media?.reddit_video ?? null;
  const hostedVideoUrl = readTrimmedString(redditVideo?.fallback_url);

  if (isLikelyVideoUrl(hostedVideoUrl)) {
    return hostedVideoUrl;
  }

  const directPostUrl = readTrimmedString(post.url);

  if (isLikelyVideoUrl(directPostUrl)) {
    return directPostUrl;
  }

  return null;
}

function readBestRedditHlsUrl(post: RedditPostData) {
  const redditVideo =
    post.secure_media?.reddit_video ?? post.media?.reddit_video ?? null;
  const hostedHlsUrl = readTrimmedString(redditVideo?.hls_url);

  if (isValidHttpUrl(hostedHlsUrl)) {
    return hostedHlsUrl;
  }

  return null;
}

function readRedditVideoHasAudio(post: RedditPostData) {
  const redditVideo =
    post.secure_media?.reddit_video ?? post.media?.reddit_video ?? null;

  if (typeof redditVideo?.has_audio === "boolean") {
    return redditVideo.has_audio;
  }

  return null;
}

export function inferStoryTag(article: {
  title?: string | null;
  description?: string | null;
}) {
  const sourceText = `${readTrimmedString(article.title) ?? ""} ${
    readTrimmedString(article.description) ?? ""
  }`.toLowerCase();

  if (/(basketball|nba|wnba|ncaa|dunk|buzzer|hoops|march madness|final four)/.test(sourceText)) {
    return "Basketball" as const;
  }

  if (
    /(soccer|football|goal|premier league|champions league|mls|fifa|derby|nfl|touchdown|quarterback|wide receiver|cfb|sec|big ten)/.test(
      sourceText,
    )
  ) {
    return "Football" as const;
  }

  if (/(hockey|nhl|puck|goalie|power play|rink|overtime|stanley cup)/.test(sourceText)) {
    return "Hockey" as const;
  }

  if (/(formula 1|f1|motogp|indycar|nascar|grand prix|pit stop|race car|lap)/.test(sourceText)) {
    return "Motorsport" as const;
  }

  if (/(track|relay|sprint|meter|metres|mile|marathon|field event|world athletics)/.test(sourceText)) {
    return "Track" as const;
  }

  return "Sports" as const;
}

export function sanitizeSummary(value: unknown) {
  const candidate = normalizeText(value);
  return candidate || "Top discussion on Reddit right now.";
}

export function sanitizeContent(value: unknown) {
  const candidate = normalizeText(value);
  return candidate || "Open the Reddit thread for the full discussion.";
}

export function isValidHttpUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeStoryUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    const retainedQueryParams = Array.from(parsedUrl.searchParams.entries())
      .filter(([name]) => !isTrackingQueryParam(name))
      .sort(([leftName, leftValue], [rightName, rightValue]) => {
        if (leftName === rightName) {
          return leftValue.localeCompare(rightValue);
        }

        return leftName.localeCompare(rightName);
      });

    parsedUrl.search = "";
    parsedUrl.hash = "";

    for (const [name, value] of retainedQueryParams) {
      parsedUrl.searchParams.append(name, value);
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function isTrackingQueryParam(name: string) {
  const normalizedName = name.trim().toLowerCase();
  return normalizedName.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(normalizedName);
}

function createStoryId(url: string) {
  const slug = url
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

  let hash = 0;

  for (const character of url) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return `${slug || "sports-story"}-${hash.toString(36)}`;
}

function normalizePaginationValue(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

export function buildMockStoriesResponse({
  page = 1,
  pageSize = 6,
}: {
  page?: number;
  pageSize?: number;
} = {}): StoriesResponse {
  const normalizedPage = normalizePaginationValue(page, 1);
  const normalizedPageSize = normalizePaginationValue(pageSize, 6);
  const startIndex = (normalizedPage - 1) * normalizedPageSize;
  const items = mockStories.slice(startIndex, startIndex + normalizedPageSize);
  const totalResults = mockStories.length;
  const hasMore = startIndex + items.length < totalResults;

  return {
    items,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalResults,
    hasMore,
    nextPage: hasMore ? normalizedPage + 1 : null,
  };
}

function mapRedditPostToStory(
  post: RedditPostData,
  definition: RedditSourceDefinition,
): Story | null {
  const headline = readTrimmedString(post.title);
  const permalink = readTrimmedString(post.permalink);

  if (!headline || !permalink) {
    return null;
  }

  const url = normalizeStoryUrl(`https://www.reddit.com${permalink}`);

  if (!url) {
    return null;
  }

  const createdUtc =
    typeof post.created_utc === "number" && Number.isFinite(post.created_utc)
      ? post.created_utc
      : null;

  if (createdUtc === null) {
    return null;
  }

  const publishedAt = new Date(createdUtc * 1000);

  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  const summary = buildRedditSummary(post, definition.source);
  const tag = definition.defaultTag;
  const fallbackSrc = SPORT_FALLBACK_IMAGES[tag];
  const previewImageSrc = readBestRedditImageUrl(post);
  const previewVideoSrc = readBestRedditVideoUrl(post);
  const previewVideoHlsSrc = readBestRedditHlsUrl(post);
  const previewVideoHasAudio = readRedditVideoHasAudio(post);

  return {
    id: createStoryId(url),
    headline,
    summary: sanitizeSummary(summary),
    content: sanitizeContent(buildRedditContent(post, definition.source)),
    source: definition.source,
    author: readTrimmedString(post.author) ? `u/${readTrimmedString(post.author)}` : null,
    publishedAt: publishedAt.toISOString(),
    tag,
    url,
    image: {
      src: previewImageSrc ?? fallbackSrc,
      alt: headline,
      fallbackSrc,
    },
    video: previewVideoSrc
      ? {
          src: previewVideoSrc,
          hlsSrc: previewVideoHlsSrc,
          hasAudio: previewVideoHasAudio,
        }
      : null,
  };
}

function buildUnavailableRedditStory(definition: RedditSourceDefinition): Story {
  const fallbackUrl = `https://www.reddit.com/r/${definition.subreddit}/`;
  const headline = `${definition.source} is loading a new top thread`;
  const fallbackSrc = SPORT_FALLBACK_IMAGES[definition.defaultTag];

  return {
    id: createStoryId(fallbackUrl),
    headline,
    summary: `We couldn't load a live top post from ${definition.source} right now, so this card links to the subreddit until Reddit responds again.`,
    content: `Open ${definition.source} on Reddit to browse the current top threads and discussion.`,
    source: definition.source,
    author: null,
    publishedAt: new Date().toISOString(),
    tag: definition.defaultTag,
    url: fallbackUrl,
    image: {
      src: fallbackSrc,
      alt: headline,
      fallbackSrc,
    },
    video: null,
  };
}

function normalizeRedditListing(
  payload: unknown,
  definition: RedditSourceDefinition,
): Story | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.children)) {
    return null;
  }

  const children = payload.data.children;

  for (const child of children) {
    if (!isRecord(child) || !isRecord(child.data)) {
      continue;
    }

    const post = child.data as RedditPostData;

    if (post.stickied) {
      continue;
    }

    const story = mapRedditPostToStory(post, definition);

    if (story) {
      return story;
    }
  }

  return null;
}

async function fetchRedditListing(
  definition: RedditSourceDefinition,
  kind: RedditListingKind,
) {
  const requestUrl = new URL(
    `https://www.reddit.com/r/${definition.subreddit}/${kind}.json`,
  );
  requestUrl.searchParams.set("limit", `${REDDIT_LISTING_LIMIT}`);
  requestUrl.searchParams.set("raw_json", "1");

  if (kind === "top") {
    requestUrl.searchParams.set("t", "day");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort("timeout");
  }, REDDIT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "sporting-news-carousel/0.1",
      },
      next: {
        revalidate: REDDIT_REVALIDATE_SECONDS,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new NewsApiRequestError(
        `Reddit request for ${definition.source} failed with status ${response.status}.`,
        response.status,
      );
    }

    const payload = (await response.json()) as unknown;
    return normalizeRedditListing(payload, definition);
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new NewsApiRequestError("Reddit timed out while loading top posts.", 504);
    }

    if (error instanceof NewsApiRequestError) {
      throw error;
    }

    throw new NewsApiRequestError("Unable to reach Reddit.", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTopRedditPost(definition: RedditSourceDefinition) {
  let firstRequestError: NewsApiRequestError | null = null;

  for (const kind of REDDIT_LISTING_KINDS) {
    try {
      const story = await fetchRedditListing(definition, kind);

      if (story) {
        return story;
      }
    } catch (error) {
      if (!firstRequestError && error instanceof NewsApiRequestError) {
        firstRequestError = error;
      }
    }
  }

  if (firstRequestError) {
    throw firstRequestError;
  }

  return buildUnavailableRedditStory(definition);
}

export async function fetchSportsStories({
  page = 1,
  pageSize = 6,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<StoriesResponse> {
  const normalizedPage = normalizePaginationValue(page, 1);
  const normalizedPageSize = normalizePaginationValue(pageSize, 6);
  const results = await Promise.allSettled(REDDIT_TOP_SOURCES.map(fetchTopRedditPost));
  const stories: Story[] = [];

  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      stories.push(result.value);
      continue;
    }

    stories.push(buildUnavailableRedditStory(REDDIT_TOP_SOURCES[index]));
  }

  const allRequestsFailed = results.every((result) => result.status === "rejected");

  if (allRequestsFailed) {
    const rejectedFailures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    const firstFailure = rejectedFailures[0];

    const allFailuresAreAccessBlocks = rejectedFailures.every((result) => {
      return (
        result.reason instanceof NewsApiRequestError &&
        (result.reason.status === 401 ||
          result.reason.status === 403 ||
          result.reason.status === 429)
      );
    });

    if (allFailuresAreAccessBlocks) {
      const startIndex = (normalizedPage - 1) * normalizedPageSize;
      const items = stories.slice(startIndex, startIndex + normalizedPageSize);
      const totalResults = stories.length;
      const hasMore = startIndex + items.length < totalResults;

      return {
        items,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalResults,
        hasMore,
        nextPage: hasMore ? normalizedPage + 1 : null,
      };
    }

    if (
      firstFailure &&
      firstFailure.reason instanceof NewsApiRequestError
    ) {
      throw firstFailure.reason;
    }

    throw new NewsApiRequestError("Unable to load Reddit posts.", 502);
  }

  const startIndex = (normalizedPage - 1) * normalizedPageSize;
  const items = stories.slice(startIndex, startIndex + normalizedPageSize);
  const totalResults = stories.length;
  const hasMore = startIndex + items.length < totalResults;

  return {
    items,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalResults,
    hasMore,
    nextPage: hasMore ? normalizedPage + 1 : null,
  };
}
