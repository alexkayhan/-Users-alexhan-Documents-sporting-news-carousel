import type { TopGame, TopGamesResponse, TopGameTeam } from "@/lib/types";

const ESPN_TOP_ODDS_URL = "https://www.espn.com/sports-betting/odds";
const TOP_GAMES_REQUEST_TIMEOUT_MS = 8000;
const TOP_GAMES_SOURCE = "ESPN Top Odds and Games";

type EspnOddsEventStatus = {
  period?: number | null;
  periodPrefix?: string | null;
  type?: {
    completed?: boolean | null;
    detail?: string | null;
    shortDetail?: string | null;
    state?: string | null;
  } | null;
};

type EspnOddsCompetitor = {
  homeAway?: string | null;
  score?: number | string | null;
  team?: {
    abbreviation?: string | null;
    displayName?: string | null;
    shortDisplayName?: string | null;
    name?: string | null;
  } | null;
};

type EspnPointSpread = {
  home?: {
    close?: {
      line?: string | null;
      odds?: string | null;
    } | null;
  } | null;
  away?: {
    close?: {
      line?: string | null;
      odds?: string | null;
    } | null;
  } | null;
};

type EspnOddsProvider = {
  displayName?: string | null;
  name?: string | null;
};

type EspnOddsLine = {
  provider?: EspnOddsProvider | null;
  link?: {
    href?: string | null;
  } | null;
  pointSpread?: EspnPointSpread | null;
};

type EspnGameOddRow = {
  line?: {
    primaryText?: string | null;
    primaryTextFull?: string | null;
    primaryTextFullWide?: string | null;
  } | null;
  pointSpread?: {
    primary?: string | null;
    secondary?: string | null;
  } | null;
};

type EspnGameOdd = {
  gameBetLink?: string | null;
  gameCastLink?: string | null;
  odds?: EspnGameOddRow[] | null;
  providerName?: string | null;
};

type EspnOddsEvent = {
  id?: string | number | null;
  date?: string | null;
  status?: EspnOddsEventStatus | null;
  competitors?: EspnOddsCompetitor[] | null;
  odds?: EspnOddsLine[] | null;
  links?: Array<{
    href?: string | null;
    rel?: string[] | null;
  }> | null;
  gameOdd?: EspnGameOdd | null;
};

type EspnOddsGroup = {
  displayValue?: string | null;
  lines?: EspnOddsEvent[] | null;
};

type EspnTopOddsPayload = {
  page?: {
    content?: {
      odds?: {
        odds?: EspnOddsGroup[] | null;
        providerName?: string | null;
      } | null;
    } | null;
  } | null;
};

export class TopGamesRequestError extends Error {
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

function normalizeEspnPathUrl(value: string | null | undefined) {
  const trimmedValue = readTrimmedString(value);

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return `https://www.espn.com${trimmedValue}`;
  }

  return null;
}

function normalizeStatusState(status: EspnOddsEventStatus | null | undefined) {
  const rawState = readTrimmedString(status?.type?.state)?.toLowerCase();

  if (status?.type?.completed || rawState === "post") {
    return "post" as const;
  }

  if (rawState === "in" || rawState === "live") {
    return "in" as const;
  }

  return "pre" as const;
}

function normalizeStatusDetail(
  status: EspnOddsEventStatus | null | undefined,
  state: TopGame["status"]["state"],
) {
  const detail =
    readTrimmedString(status?.type?.shortDetail) ??
    readTrimmedString(status?.type?.detail);

  if (detail) {
    return detail;
  }

  if (state === "post") {
    return "Final";
  }

  if (state === "in") {
    return "Live";
  }

  return "Scheduled";
}

function readScoreValue(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return readTrimmedString(value);
}

function readCompetitor(
  competitors: EspnOddsCompetitor[] | null | undefined,
  homeAway: "away" | "home",
) {
  return competitors?.find((competitor) => competitor.homeAway === homeAway) ?? null;
}

function readCompetitorTeam(
  competitor: EspnOddsCompetitor | null,
  spreadData: EspnPointSpread | null | undefined,
  gameOddRows: EspnGameOddRow[] | null | undefined,
  homeAway: "away" | "home",
): TopGameTeam | null {
  const abbreviation = readTrimmedString(competitor?.team?.abbreviation);
  const displayName =
    readTrimmedString(competitor?.team?.displayName) ??
    readTrimmedString(competitor?.team?.shortDisplayName) ??
    readTrimmedString(competitor?.team?.name);

  if (!abbreviation || !displayName) {
    return null;
  }

  const marketSide = homeAway === "away" ? spreadData?.away : spreadData?.home;
  const matchingGameOddRow = gameOddRows?.find((row) => {
    const primaryText = readTrimmedString(row.line?.primaryText);
    return primaryText === abbreviation;
  });

  return {
    abbreviation,
    displayName,
    score: readScoreValue(competitor?.score),
    spread:
      readTrimmedString(marketSide?.close?.line) ??
      readTrimmedString(matchingGameOddRow?.pointSpread?.primary),
    spreadOdds:
      readTrimmedString(marketSide?.close?.odds) ??
      readTrimmedString(matchingGameOddRow?.pointSpread?.secondary),
  };
}

function readDraftKingsOddsLine(
  oddsLines: EspnOddsLine[] | null | undefined,
  fallbackProviderName: string | null,
) {
  if (!Array.isArray(oddsLines) || oddsLines.length === 0) {
    return null;
  }

  return (
    oddsLines.find((oddsLine) => {
      const providerName =
        readTrimmedString(oddsLine.provider?.displayName) ??
        readTrimmedString(oddsLine.provider?.name) ??
        fallbackProviderName;

      return providerName?.toLowerCase() === "draftkings";
    }) ?? oddsLines[0]
  );
}

function readScoreboardUrl(event: EspnOddsEvent) {
  const summaryLink = event.links?.find((link) => link.rel?.includes("summary"));
  return normalizeEspnPathUrl(summaryLink?.href ?? event.gameOdd?.gameCastLink ?? null);
}

function normalizeTopGame(
  event: EspnOddsEvent,
  league: string,
  fallbackProviderName: string | null,
) {
  const id = readTrimmedString(event.id ? String(event.id) : null);
  const startTime = readTrimmedString(event.date);

  if (!id || !startTime || Number.isNaN(Date.parse(startTime))) {
    return null;
  }

  const statusState = normalizeStatusState(event.status);
  const statusDetail = normalizeStatusDetail(event.status, statusState);
  const draftKingsOdds = readDraftKingsOddsLine(event.odds, fallbackProviderName);
  const awayTeam = readCompetitorTeam(
    readCompetitor(event.competitors, "away"),
    draftKingsOdds?.pointSpread,
    event.gameOdd?.odds,
    "away",
  );
  const homeTeam = readCompetitorTeam(
    readCompetitor(event.competitors, "home"),
    draftKingsOdds?.pointSpread,
    event.gameOdd?.odds,
    "home",
  );

  if (!awayTeam || !homeTeam) {
    return null;
  }

  return {
    id,
    league,
    provider: "DraftKings",
    startTime,
    away: awayTeam,
    home: homeTeam,
    status: {
      state: statusState,
      detail:
        readTrimmedString(event.status?.type?.detail) ??
        readTrimmedString(event.status?.type?.shortDetail) ??
        statusDetail,
      shortDetail: statusDetail,
      isComplete: statusState === "post",
    },
    gameUrl:
      readTrimmedString(event.gameOdd?.gameBetLink) ??
      readTrimmedString(draftKingsOdds?.link?.href) ??
      null,
    scoreboardUrl: readScoreboardUrl(event),
  } satisfies TopGame;
}

export function parseTopGamesFromEspnOddsHtml(
  html: string,
  limit = 5,
): TopGamesResponse {
  const bootstrappedPayloadMatch = html.match(
    /window\['__espnfitt__'\]=([\s\S]+?);<\/script>/,
  );

  if (!bootstrappedPayloadMatch) {
    throw new TopGamesRequestError(
      "Unable to locate the DraftKings odds payload.",
      502,
    );
  }

  let payload: EspnTopOddsPayload;

  try {
    payload = JSON.parse(bootstrappedPayloadMatch[1]) as EspnTopOddsPayload;
  } catch {
    throw new TopGamesRequestError(
      "Unable to read the DraftKings odds payload.",
      502,
    );
  }

  const oddsRoot = payload.page?.content?.odds;
  const oddsGroups = oddsRoot?.odds;

  if (!Array.isArray(oddsGroups)) {
    throw new TopGamesRequestError(
      "DraftKings odds data is unavailable right now.",
      502,
    );
  }

  const providerName = readTrimmedString(oddsRoot?.providerName) ?? "DraftKings";
  const items: TopGame[] = [];

  for (const group of oddsGroups) {
    const league = readTrimmedString(group.displayValue) ?? "Top Game";

    if (!Array.isArray(group.lines)) {
      continue;
    }

    for (const event of group.lines) {
      const normalizedGame = normalizeTopGame(event, league, providerName);

      if (!normalizedGame) {
        continue;
      }

      items.push(normalizedGame);

      if (items.length >= limit) {
        break;
      }
    }

    if (items.length >= limit) {
      break;
    }
  }

  if (items.length === 0) {
    throw new TopGamesRequestError(
      "DraftKings odds data is unavailable right now.",
      502,
    );
  }

  return {
    items,
    provider: "DraftKings",
    source: TOP_GAMES_SOURCE,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTopGames(limit = 5) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), TOP_GAMES_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ESPN_TOP_ODDS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TopGamesRequestError(
        "Unable to load the DraftKings games board.",
        response.status,
      );
    }

    const html = await response.text();
    return parseTopGamesFromEspnOddsHtml(html, limit);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new TopGamesRequestError(
        "Loading the DraftKings games board timed out.",
        504,
      );
    }

    if (error instanceof TopGamesRequestError) {
      throw error;
    }

    throw new TopGamesRequestError(
      "Unable to load the DraftKings games board.",
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function shouldShowFinalScore(game: TopGame) {
  return game.status.state === "post";
}

export function formatSpreadSummary(game: TopGame) {
  const awaySpread = game.away.spread ? `${game.away.abbreviation} ${game.away.spread}` : null;
  const homeSpread = game.home.spread ? `${game.home.abbreviation} ${game.home.spread}` : null;

  if (awaySpread && homeSpread) {
    return `${awaySpread} • ${homeSpread}`;
  }

  return awaySpread ?? homeSpread ?? "Spread unavailable";
}

export function formatScoreSummary(game: TopGame) {
  const awayScore = game.away.score ?? "0";
  const homeScore = game.home.score ?? "0";
  return `${awayScore} - ${homeScore}`;
}

export function formatTopGameStartTime(
  startTime: string,
  options?: {
    locale?: string;
    timeZone?: string;
  },
) {
  return new Intl.DateTimeFormat(options?.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options?.timeZone,
    timeZoneName: "short",
  }).format(new Date(startTime));
}

export function getTopGameLink(game: TopGame) {
  return normalizeEspnPathUrl(game.gameUrl) ?? normalizeEspnPathUrl(game.scoreboardUrl);
}

export function isValidTopGamesResponse(value: unknown): value is TopGamesResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every((item) => {
    if (!isRecord(item) || !isRecord(item.away) || !isRecord(item.home) || !isRecord(item.status)) {
      return false;
    }

    return (
      readTrimmedString(item.id) !== null &&
      readTrimmedString(item.league) !== null &&
      readTrimmedString(item.startTime) !== null &&
      item.provider === "DraftKings" &&
      readTrimmedString(item.away.abbreviation) !== null &&
      readTrimmedString(item.home.abbreviation) !== null &&
      readTrimmedString(item.status.detail) !== null &&
      readTrimmedString(item.status.shortDetail) !== null
    );
  });
}
