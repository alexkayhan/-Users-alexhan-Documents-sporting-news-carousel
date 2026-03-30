import type { StoriesResponse, Story, StoryTag } from "@/lib/types";
import { mockStories } from "@/data/mock-stories";

type EspnRssSourceDefinition = {
  feedUrl: string;
  sectionUrl: string;
  source: string;
  defaultTag: StoryTag;
};

const ESPN_RSS_SOURCES: EspnRssSourceDefinition[] = [
  {
    feedUrl: "https://www.espn.com/espn/rss/nfl/news",
    sectionUrl: "https://www.espn.com/nfl/",
    source: "ESPN NFL",
    defaultTag: "Football",
  },
  {
    feedUrl: "https://www.espn.com/espn/rss/nba/news",
    sectionUrl: "https://www.espn.com/nba/",
    source: "ESPN NBA",
    defaultTag: "Basketball",
  },
  {
    feedUrl: "https://www.espn.com/espn/rss/mlb/news",
    sectionUrl: "https://www.espn.com/mlb/",
    source: "ESPN MLB",
    defaultTag: "Baseball",
  },
  {
    feedUrl: "https://www.espn.com/espn/rss/nhl/news",
    sectionUrl: "https://www.espn.com/nhl/",
    source: "ESPN NHL",
    defaultTag: "Hockey",
  },
  {
    feedUrl: "https://www.espn.com/espn/rss/ncf/news",
    sectionUrl: "https://www.espn.com/college-football/",
    source: "ESPN College Football",
    defaultTag: "Football",
  },
  {
    feedUrl: "https://www.espn.com/espn/rss/ncb/news",
    sectionUrl: "https://www.espn.com/mens-college-basketball/",
    source: "ESPN College Basketball",
    defaultTag: "Basketball",
  },
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

const ESPN_REQUEST_TIMEOUT_MS = 8000;
const ESPN_REVALIDATE_SECONDS = 6 * 60 * 60;
const XML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export class NewsApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unwrapCdata(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }

      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }

      return XML_ENTITY_MAP[entity] ?? match;
    },
  );
}

function normalizeFeedText(value: unknown, stripMarkup = false) {
  const trimmedValue = readTrimmedString(value);

  if (!trimmedValue) {
    return "";
  }

  const withoutCdata = unwrapCdata(trimmedValue);
  const withoutMarkup = stripMarkup ? stripHtmlTags(withoutCdata) : withoutCdata;
  return normalizeText(decodeHtmlEntities(withoutMarkup));
}

function extractXmlText(xml: string, tagName: string) {
  const tagPattern = escapeRegex(tagName);
  const match = xml.match(
    new RegExp(
      `<${tagPattern}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagPattern}>`,
      "i",
    ),
  );

  return match?.[1] ?? null;
}

function extractRssItems(xml: string) {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi), (match) => match[0]);
}

export function inferStoryTag(article: {
  title?: string | null;
  description?: string | null;
}) {
  const sourceText = `${readTrimmedString(article.title) ?? ""} ${
    readTrimmedString(article.description) ?? ""
  }`.toLowerCase();

  if (
    /(basketball|nba|wnba|ncaa|dunk|buzzer|hoops|march madness|final four)/.test(
      sourceText,
    )
  ) {
    return "Basketball" as const;
  }

  if (
    /(football|goal|nfl|touchdown|quarterback|wide receiver|cfb|sec|big ten|college football)/.test(
      sourceText,
    )
  ) {
    return "Football" as const;
  }

  if (/(baseball|mlb|home run|pitcher|inning|grand slam|closer)/.test(sourceText)) {
    return "Baseball" as const;
  }

  if (/(hockey|nhl|puck|goalie|power play|rink|overtime|stanley cup)/.test(sourceText)) {
    return "Hockey" as const;
  }

  if (
    /(formula 1|f1|motogp|indycar|nascar|grand prix|pit stop|race car|lap)/.test(
      sourceText,
    )
  ) {
    return "Motorsport" as const;
  }

  if (
    /(track|relay|sprint|meter|metres|mile|marathon|field event|world athletics)/.test(
      sourceText,
    )
  ) {
    return "Track" as const;
  }

  return "Sports" as const;
}

export function sanitizeSummary(value: unknown) {
  const candidate = normalizeFeedText(value, true);
  return candidate || "Latest sports headline from ESPN.";
}

export function sanitizeContent(value: unknown) {
  const candidate = normalizeFeedText(value, true);
  return candidate || "Open the original ESPN story for the full article.";
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

function mapEspnItemToStory(
  itemXml: string,
  definition: EspnRssSourceDefinition,
): Story | null {
  const headline = normalizeFeedText(extractXmlText(itemXml, "title"));
  const description = normalizeFeedText(extractXmlText(itemXml, "description"), true);
  const link = normalizeStoryUrl(normalizeFeedText(extractXmlText(itemXml, "link")));
  const author = normalizeFeedText(extractXmlText(itemXml, "dc:creator")) || null;
  const publishedAtText = normalizeFeedText(extractXmlText(itemXml, "pubDate"));

  if (!headline || !link || !publishedAtText) {
    return null;
  }

  const publishedAt = new Date(publishedAtText);

  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  const summary = sanitizeSummary(description || headline);
  const fallbackSrc = SPORT_FALLBACK_IMAGES[definition.defaultTag];

  return {
    id: createStoryId(link),
    headline,
    summary,
    content: sanitizeContent(description || headline),
    source: definition.source,
    author,
    publishedAt: publishedAt.toISOString(),
    tag: definition.defaultTag,
    url: link,
    image: {
      src: fallbackSrc,
      alt: headline,
      fallbackSrc,
    },
    video: null,
  };
}

function normalizeEspnRssFeed(
  feedXml: string,
  definition: EspnRssSourceDefinition,
): Story | null {
  for (const itemXml of extractRssItems(feedXml)) {
    const story = mapEspnItemToStory(itemXml, definition);

    if (story) {
      return story;
    }
  }

  return null;
}

function buildUnavailableEspnStory(definition: EspnRssSourceDefinition): Story {
  const fallbackUrl = definition.sectionUrl;
  const fallbackSrc = SPORT_FALLBACK_IMAGES[definition.defaultTag];
  const headline = `${definition.source} is loading a new headline`;

  return {
    id: createStoryId(fallbackUrl),
    headline,
    summary: `We couldn't load the latest ${definition.source} RSS story right now, so this card links to ESPN until the feed updates again.`,
    content: `Open ${definition.source} on ESPN to browse the latest headlines and coverage.`,
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

async function fetchEspnRssStory(definition: EspnRssSourceDefinition) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort("timeout");
  }, ESPN_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(definition.feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "sporting-news-carousel/1.0 (+https://vercel.com)",
      },
      next: {
        revalidate: ESPN_REVALIDATE_SECONDS,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new NewsApiRequestError(
        `ESPN RSS request for ${definition.source} failed with status ${response.status}.`,
        response.status,
      );
    }

    const feedXml = await response.text();
    const story = normalizeEspnRssFeed(feedXml, definition);

    return story ?? buildUnavailableEspnStory(definition);
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new NewsApiRequestError("ESPN RSS timed out while loading headlines.", 504);
    }

    if (error instanceof NewsApiRequestError) {
      throw error;
    }

    throw new NewsApiRequestError("Unable to reach ESPN RSS.", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTopEspnStory(definition: EspnRssSourceDefinition) {
  try {
    return await fetchEspnRssStory(definition);
  } catch {
    return buildUnavailableEspnStory(definition);
  }
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
  const stories = await Promise.all(ESPN_RSS_SOURCES.map(fetchTopEspnStory));
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
