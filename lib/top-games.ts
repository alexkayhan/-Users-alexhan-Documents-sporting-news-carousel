import type { TopGame, TopGamesResponse, TopGameState, TopGameTeam } from "@/lib/types";

const DRAFTKINGS_LIVE_URL =
  "https://sportsbook-nash.draftkings.com/api/sportscontent/views/dkusnj/v1/live";
const DRAFTKINGS_BASE_URL = "https://sportsbook.draftkings.com";
const TOP_GAMES_REQUEST_TIMEOUT_MS = 8000;
const TOP_GAMES_SOURCE = "DraftKings live sportsbook board";
export const TOP_GAMES_TIME_ZONE = "America/Los_Angeles";

type DraftKingsParticipant = {
  id?: string | number | null;
  name?: string | null;
  venueRole?: string | null;
  seoIdentifier?: string | null;
  metadata?: {
    shortName?: string | null;
  } | null;
};

type DraftKingsLiveGameState = {
  period?: string | null;
  gameTime?: number | null;
  minute?: number | string | null;
  second?: number | string | null;
};

type DraftKingsEvent = {
  id?: string | number | null;
  seoIdentifier?: string | null;
  leagueId?: string | number | null;
  name?: string | null;
  startEventDate?: string | null;
  participants?: DraftKingsParticipant[] | null;
  status?: string | null;
  liveGameState?: DraftKingsLiveGameState | null;
  eventScore?: {
    mainScore?: {
      homeScore?: string | number | null;
      awayScore?: string | number | null;
    } | null;
  } | null;
  sortOrder?: number | null;
};

type DraftKingsMarket = {
  id?: string | null;
  eventId?: string | number | null;
  name?: string | null;
  marketType?: {
    betOfferTypeId?: number | null;
    name?: string | null;
  } | null;
};

type DraftKingsSelection = {
  id?: string | null;
  marketId?: string | null;
  label?: string | null;
  points?: string | number | null;
  displayOdds?: {
    american?: string | null;
  } | null;
  outcomeType?: string | null;
  participants?: DraftKingsParticipant[] | null;
};

type DraftKingsSection = {
  id?: string | number | null;
  name?: string | null;
  sortOrder?: number | null;
  associatedData?: {
    seoIdentifier?: string | null;
  } | null;
};

type DraftKingsLivePayload = {
  events?: DraftKingsEvent[] | null;
  markets?: DraftKingsMarket[] | null;
  selections?: DraftKingsSelection[] | null;
  sections?: DraftKingsSection[] | null;
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

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function readScoreValue(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return readTrimmedString(value);
}

function normalizeOddsString(value: unknown) {
  const oddsValue = readTrimmedString(value);

  if (!oddsValue) {
    return null;
  }

  return oddsValue.replace(/\u2212/g, "-");
}

function normalizeDraftKingsUrl(value: string | null | undefined) {
  const trimmedValue = readTrimmedString(value);

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return `${DRAFTKINGS_BASE_URL}${trimmedValue}`;
  }

  return null;
}

function formatSpreadValue(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0) {
      return `+${value}`;
    }

    return String(value);
  }

  const spreadValue = readTrimmedString(value);

  if (!spreadValue) {
    return null;
  }

  const normalizedValue = spreadValue.replace(/\u2212/g, "-");

  if (
    normalizedValue.startsWith("+") ||
    normalizedValue.startsWith("-") ||
    normalizedValue === "0"
  ) {
    return normalizedValue;
  }

  const numericValue = Number(normalizedValue);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return `+${normalizedValue}`;
  }

  return normalizedValue;
}

function normalizeTopGameState(status: string | null | undefined): TopGameState {
  const normalizedStatus = readTrimmedString(status)?.toUpperCase();

  if (!normalizedStatus) {
    return "pre";
  }

  if (
    normalizedStatus === "FINAL" ||
    normalizedStatus === "ENDED" ||
    normalizedStatus === "FINISHED" ||
    normalizedStatus === "COMPLETED" ||
    normalizedStatus === "OFFICIAL"
  ) {
    return "post";
  }

  if (normalizedStatus === "STARTED" || normalizedStatus === "LIVE" || normalizedStatus === "IN") {
    return "in";
  }

  return "pre";
}

function formatLiveClock(liveGameState: DraftKingsLiveGameState | null | undefined) {
  const gameTime = readNumber(liveGameState?.gameTime);

  if (gameTime !== null) {
    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime - minutes * 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const minutes = readNumber(liveGameState?.minute);
  const seconds = readNumber(liveGameState?.second);

  if (minutes !== null && seconds !== null) {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return null;
}

function normalizeStatusDetail(event: DraftKingsEvent, state: TopGameState) {
  if (state === "post") {
    return {
      detail: "Final",
      shortDetail: "Final",
    };
  }

  if (state === "in") {
    const period = readTrimmedString(event.liveGameState?.period);
    const clock = formatLiveClock(event.liveGameState);
    const shortDetail = period && clock ? `${period} ${clock}` : period ?? clock ?? "Live";

    return {
      detail: shortDetail,
      shortDetail,
    };
  }

  return {
    detail: "Scheduled",
    shortDetail: "Scheduled",
  };
}

function buildEventUrl(event: DraftKingsEvent) {
  const eventId = readTrimmedString(event.id ? String(event.id) : null);
  const seoIdentifier = readTrimmedString(event.seoIdentifier);

  if (!eventId) {
    return null;
  }

  if (seoIdentifier) {
    return `${DRAFTKINGS_BASE_URL}/event/${seoIdentifier}/${eventId}`;
  }

  return `${DRAFTKINGS_BASE_URL}/event/${eventId}`;
}

function readParticipant(
  participants: DraftKingsParticipant[] | null | undefined,
  venueRole: "Away" | "Home",
) {
  return (
    participants?.find((participant) => readTrimmedString(participant.venueRole) === venueRole) ??
    null
  );
}

function readTopGameTeam(
  participant: DraftKingsParticipant | null,
  score: string | number | null | undefined,
  spreadSelection: DraftKingsSelection | null,
): TopGameTeam | null {
  const displayName = readTrimmedString(participant?.name);
  const abbreviation =
    readTrimmedString(participant?.metadata?.shortName) ??
    readTrimmedString(spreadSelection?.participants?.[0]?.metadata?.shortName) ??
    displayName;

  if (!displayName || !abbreviation) {
    return null;
  }

  return {
    abbreviation,
    displayName,
    score: readScoreValue(score),
    spread: formatSpreadValue(spreadSelection?.points),
    spreadOdds: normalizeOddsString(spreadSelection?.displayOdds?.american),
  };
}

function selectPrimarySpreadMarket(markets: DraftKingsMarket[]) {
  return (
    markets.find((market) => market.marketType?.betOfferTypeId === 1) ??
    markets.find((market) => {
      const marketName = readTrimmedString(market.name)?.toLowerCase();
      return (
        marketName === "spread" ||
        marketName === "run line" ||
        marketName === "puck line" ||
        marketName === "point spread"
      );
    }) ??
    null
  );
}

function buildSelectionGroups(selections: DraftKingsSelection[]) {
  const selectionsByMarketId = new Map<string, DraftKingsSelection[]>();

  for (const selection of selections) {
    const marketId = readTrimmedString(selection.marketId);

    if (!marketId) {
      continue;
    }

    const currentSelections = selectionsByMarketId.get(marketId) ?? [];
    currentSelections.push(selection);
    selectionsByMarketId.set(marketId, currentSelections);
  }

  return selectionsByMarketId;
}

function readSpreadSelection(
  selectionsByMarketId: Map<string, DraftKingsSelection[]>,
  market: DraftKingsMarket | null,
  venueRole: "Away" | "Home",
) {
  const marketId = readTrimmedString(market?.id);

  if (!marketId) {
    return null;
  }

  const selections = selectionsByMarketId.get(marketId);

  if (!Array.isArray(selections)) {
    return null;
  }

  return (
    selections.find((selection) => {
      const participant = selection.participants?.[0];
      return (
        readTrimmedString(participant?.venueRole) === venueRole ||
        readTrimmedString(selection.outcomeType)?.toLowerCase() === venueRole.toLowerCase()
      );
    }) ?? null
  );
}

function normalizeTopGame(
  event: DraftKingsEvent,
  section: DraftKingsSection | null,
  marketsByEventId: Map<string, DraftKingsMarket[]>,
  selectionsByMarketId: Map<string, DraftKingsSelection[]>,
): TopGame | null {
  const id = readTrimmedString(event.id ? String(event.id) : null);
  const startTime = readTrimmedString(event.startEventDate);

  if (!id || !startTime || Number.isNaN(Date.parse(startTime))) {
    return null;
  }

  const league = readTrimmedString(section?.name) ?? "Live Game";
  const statusState = normalizeTopGameState(event.status);
  const normalizedStatus = normalizeStatusDetail(event, statusState);
  const eventMarkets = marketsByEventId.get(id) ?? [];
  const spreadMarket = selectPrimarySpreadMarket(eventMarkets);
  const awaySpreadSelection = readSpreadSelection(selectionsByMarketId, spreadMarket, "Away");
  const homeSpreadSelection = readSpreadSelection(selectionsByMarketId, spreadMarket, "Home");
  const awayTeam = readTopGameTeam(
    readParticipant(event.participants, "Away"),
    event.eventScore?.mainScore?.awayScore,
    awaySpreadSelection,
  );
  const homeTeam = readTopGameTeam(
    readParticipant(event.participants, "Home"),
    event.eventScore?.mainScore?.homeScore,
    homeSpreadSelection,
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
      detail: normalizedStatus.detail,
      shortDetail: normalizedStatus.shortDetail,
      isComplete: statusState === "post",
    },
    gameUrl: buildEventUrl(event),
    scoreboardUrl: normalizeDraftKingsUrl("/live"),
  } satisfies TopGame;
}

export function parseTopGamesFromDraftKingsLivePayload(
  payload: DraftKingsLivePayload,
  limit = 10,
): TopGamesResponse {
  if (
    !Array.isArray(payload.events) ||
    !Array.isArray(payload.markets) ||
    !Array.isArray(payload.selections)
  ) {
    throw new TopGamesRequestError("Unable to read the DraftKings live board.", 502);
  }

  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const sectionsById = new Map<string, DraftKingsSection>();

  for (const section of sections) {
    const sectionId = readTrimmedString(section.id ? String(section.id) : null);

    if (sectionId) {
      sectionsById.set(sectionId, section);
    }
  }

  const marketsByEventId = new Map<string, DraftKingsMarket[]>();

  for (const market of payload.markets) {
    const eventId = readTrimmedString(market.eventId ? String(market.eventId) : null);

    if (!eventId) {
      continue;
    }

    const currentMarkets = marketsByEventId.get(eventId) ?? [];
    currentMarkets.push(market);
    marketsByEventId.set(eventId, currentMarkets);
  }

  const selectionsByMarketId = buildSelectionGroups(payload.selections);

  const items = payload.events
    .slice()
    .sort((leftEvent, rightEvent) => {
      const leftSection =
        sectionsById.get(readTrimmedString(leftEvent.leagueId ? String(leftEvent.leagueId) : null) ?? "");
      const rightSection =
        sectionsById.get(
          readTrimmedString(rightEvent.leagueId ? String(rightEvent.leagueId) : null) ?? "",
        );
      const leftSectionOrder = readNumber(leftSection?.sortOrder) ?? Number.MAX_SAFE_INTEGER;
      const rightSectionOrder = readNumber(rightSection?.sortOrder) ?? Number.MAX_SAFE_INTEGER;

      if (leftSectionOrder !== rightSectionOrder) {
        return leftSectionOrder - rightSectionOrder;
      }

      const leftEventOrder = readNumber(leftEvent.sortOrder) ?? Number.MAX_SAFE_INTEGER;
      const rightEventOrder = readNumber(rightEvent.sortOrder) ?? Number.MAX_SAFE_INTEGER;

      if (leftEventOrder !== rightEventOrder) {
        return leftEventOrder - rightEventOrder;
      }

      return (
        new Date(leftEvent.startEventDate ?? 0).getTime() -
        new Date(rightEvent.startEventDate ?? 0).getTime()
      );
    })
    .map((event) =>
      normalizeTopGame(
        event,
        sectionsById.get(readTrimmedString(event.leagueId ? String(event.leagueId) : null) ?? "") ??
          null,
        marketsByEventId,
        selectionsByMarketId,
      ),
    )
    .filter((game): game is TopGame => game !== null)
    .slice(0, limit);

  if (items.length === 0) {
    throw new TopGamesRequestError("DraftKings live games are unavailable right now.", 502);
  }

  return {
    items,
    provider: "DraftKings",
    source: TOP_GAMES_SOURCE,
    fetchedAt: new Date().toISOString(),
  };
}

export function collectCompletedTopGames(items: TopGame[]) {
  const completedItems: TopGame[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (item.status.state !== "post" || seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    completedItems.push(item);
  }

  return completedItems;
}

export function mergeTopGamesWithCompleted(currentItems: TopGame[], completedItems: TopGame[]) {
  const mergedItems: TopGame[] = [];
  const seenIds = new Set<string>();

  for (const item of currentItems) {
    if (seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    mergedItems.push(item);
  }

  for (const item of completedItems) {
    if (item.status.state !== "post" || seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    mergedItems.push(item);
  }

  return mergedItems;
}

export async function fetchTopGames(limit = 10) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), TOP_GAMES_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DRAFTKINGS_LIVE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TopGamesRequestError(
        "Unable to load the DraftKings live board.",
        response.status,
      );
    }

    const payload = (await response.json()) as DraftKingsLivePayload;
    return parseTopGamesFromDraftKingsLivePayload(payload, limit);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new TopGamesRequestError("Loading the DraftKings live board timed out.", 504);
    }

    if (error instanceof TopGamesRequestError) {
      throw error;
    }

    throw new TopGamesRequestError("Unable to load the DraftKings live board.", 502);
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

export function getTopGamesDateKey(
  date = new Date(),
  options?: {
    locale?: string;
    timeZone?: string;
  },
) {
  return new Intl.DateTimeFormat(options?.locale ?? "en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: options?.timeZone ?? TOP_GAMES_TIME_ZONE,
  }).format(date);
}

export function getTopGameLink(game: TopGame) {
  return normalizeDraftKingsUrl(game.gameUrl) ?? normalizeDraftKingsUrl(game.scoreboardUrl);
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
