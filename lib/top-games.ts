import type { TopGame, TopGamesResponse, TopGameState, TopGameTeam } from "@/lib/types";

const DRAFTKINGS_LIVE_URL =
  "https://sportsbook-nash.draftkings.com/api/sportscontent/views/dkusnj/v1/live";
const DRAFTKINGS_BASE_URL = "https://sportsbook.draftkings.com";
const ESPN_BASE_URL = "https://www.espn.com";
const ESPN_SITE_API_BASE_URL = "https://site.api.espn.com";
const TOP_GAMES_REQUEST_TIMEOUT_MS = 8000;
const TOP_GAMES_SOURCE = "ESPN scoreboards with DraftKings odds";
export const TOP_GAMES_TIME_ZONE = "America/Los_Angeles";

const ESPN_SCOREBOARD_CONFIGS = [
  {
    sport: "baseball",
    leagueSlug: "mlb",
    leagueAbbreviation: "MLB",
  },
  {
    sport: "basketball",
    leagueSlug: "nba",
    leagueAbbreviation: "NBA",
  },
  {
    sport: "hockey",
    leagueSlug: "nhl",
    leagueAbbreviation: "NHL",
  },
  {
    sport: "basketball",
    leagueSlug: "mens-college-basketball",
    leagueAbbreviation: "NCAAM",
  },
  {
    sport: "football",
    leagueSlug: "nfl",
    leagueAbbreviation: "NFL",
  },
  {
    sport: "football",
    leagueSlug: "college-football",
    leagueAbbreviation: "NCAAF",
  },
] as const;

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

type EspnScoreboardCompetitor = {
  homeAway?: string | null;
  score?: string | number | null;
  team?: {
    abbreviation?: string | null;
    displayName?: string | null;
    shortDisplayName?: string | null;
    name?: string | null;
    location?: string | null;
  } | null;
};

type EspnScoreboardCompetition = {
  competitors?: EspnScoreboardCompetitor[] | null;
  odds?: Array<{
    provider?: {
      name?: string | null;
    } | null;
    pointSpread?: {
      home?: {
        close?: {
          line?: string | number | null;
          odds?: string | null;
        } | null;
      } | null;
      away?: {
        close?: {
          line?: string | number | null;
          odds?: string | null;
        } | null;
      } | null;
    } | null;
  }> | null;
  status?: {
    displayClock?: string | null;
    period?: string | number | null;
    type?: {
      state?: string | null;
      completed?: boolean | null;
      detail?: string | null;
      shortDetail?: string | null;
    } | null;
  } | null;
};

type EspnScoreboardEvent = {
  id?: string | null;
  date?: string | null;
  shortName?: string | null;
  competitions?: EspnScoreboardCompetition[] | null;
  links?: Array<{
    href?: string | null;
    rel?: string[] | null;
  }> | null;
  status?: {
    type?: {
      state?: string | null;
      completed?: boolean | null;
      detail?: string | null;
      shortDetail?: string | null;
    } | null;
  } | null;
};

type EspnScoreboardPayload = {
  leagues?: Array<{
    abbreviation?: string | null;
    name?: string | null;
  }> | null;
  events?: EspnScoreboardEvent[] | null;
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

function normalizeEspnUrl(value: string | null | undefined) {
  const trimmedValue = readTrimmedString(value);

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return `${ESPN_BASE_URL}${trimmedValue}`;
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

function buildTopGameIdentity(game: TopGame) {
  return `${getTopGamesDateKey(new Date(game.startTime))}:${game.league.toUpperCase()}:${game.away.abbreviation.toUpperCase()}:${game.home.abbreviation.toUpperCase()}`;
}

function readClockSeconds(clockValue: string | null | undefined) {
  const trimmedValue = readTrimmedString(clockValue);

  if (!trimmedValue) {
    return 0;
  }

  const match = trimmedValue.match(/(\d+):(\d{2})/);

  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
}

function getTimedSportLiveRank(game: TopGame) {
  const detail = game.status.shortDetail;
  const periodMatch = detail.match(/(?:Q|P|OT)\s?(\d+)|(\d+)(?:st|nd|rd|th)/i);
  const overtimeMatch = detail.match(/\bOT\b/i);
  const periodValue = overtimeMatch
    ? 10
    : Number(periodMatch?.[1] ?? periodMatch?.[2] ?? 0);
  const remainingSeconds = readClockSeconds(detail);

  return periodValue * 10_000 - remainingSeconds;
}

function getBaseballLiveRank(game: TopGame) {
  const detail = game.status.shortDetail;
  const inningMatch = detail.match(/\b(Top|Bot)\s+(\d+)(?:st|nd|rd|th)?/i);

  if (!inningMatch) {
    return 0;
  }

  const halfInningOffset = inningMatch[1]?.toLowerCase() === "bot" ? 1 : 0;
  const inningNumber = Number(inningMatch[2] ?? 0);
  return inningNumber * 10 + halfInningOffset;
}

function getLiveGameRank(game: TopGame) {
  switch (game.league) {
    case "MLB":
      return getBaseballLiveRank(game);
    case "NBA":
    case "NHL":
    case "NFL":
    case "NCAAM":
    case "NCAAF":
      return getTimedSportLiveRank(game);
    default:
      return 0;
  }
}

function orderTopGamesForTicker(items: TopGame[]) {
  const priorityByState: Record<TopGameState, number> = {
    in: 0,
    pre: 1,
    post: 2,
  };

  return items
    .map((item, index) => ({
      item,
      index,
    }))
    .sort((left, right) => {
      const priorityDifference =
        priorityByState[left.item.status.state] - priorityByState[right.item.status.state];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      if (left.item.status.state === "in" && right.item.status.state === "in") {
        return getLiveGameRank(right.item) - getLiveGameRank(left.item);
      }

      if (left.item.status.state === "pre" && right.item.status.state === "pre") {
        return new Date(left.item.startTime).getTime() - new Date(right.item.startTime).getTime();
      }

      if (left.item.status.state === "post" && right.item.status.state === "post") {
        return new Date(right.item.startTime).getTime() - new Date(left.item.startTime).getTime();
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
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
  const seenKeys = new Set<string>();

  for (const item of items) {
    const itemKey = buildTopGameIdentity(item);

    if (item.status.state !== "post" || seenKeys.has(itemKey)) {
      continue;
    }

    seenKeys.add(itemKey);
    completedItems.push(item);
  }

  return completedItems;
}

export function mergeTopGamesWithCompleted(currentItems: TopGame[], completedItems: TopGame[]) {
  const mergedItems: TopGame[] = [];
  const seenKeys = new Set<string>();

  for (const item of currentItems) {
    const itemKey = buildTopGameIdentity(item);

    if (seenKeys.has(itemKey)) {
      continue;
    }

    seenKeys.add(itemKey);
    mergedItems.push(item);
  }

  for (const item of completedItems) {
    const itemKey = buildTopGameIdentity(item);

    if (item.status.state !== "post" || seenKeys.has(itemKey)) {
      continue;
    }

    seenKeys.add(itemKey);
    mergedItems.push(item);
  }

  return orderTopGamesForTicker(mergedItems);
}

function readEspnCompetitor(
  competitors: EspnScoreboardCompetitor[] | null | undefined,
  homeAway: "away" | "home",
) {
  return (
    competitors?.find((competitor) => readTrimmedString(competitor.homeAway)?.toLowerCase() === homeAway) ??
    null
  );
}

function readEspnTeam(competitor: EspnScoreboardCompetitor | null): TopGameTeam | null {
  const abbreviation = readTrimmedString(competitor?.team?.abbreviation);
  const displayName =
    readTrimmedString(competitor?.team?.displayName) ??
    readTrimmedString(competitor?.team?.shortDisplayName) ??
    readTrimmedString(competitor?.team?.name) ??
    readTrimmedString(competitor?.team?.location);

  if (!abbreviation || !displayName) {
    return null;
  }

  return {
    abbreviation,
    displayName,
    score: readScoreValue(competitor?.score),
    spread: null,
    spreadOdds: null,
  };
}

function readPreferredEspnOdds(
  odds: EspnScoreboardCompetition["odds"],
): NonNullable<EspnScoreboardCompetition["odds"]>[number] | null {
  if (!Array.isArray(odds)) {
    return null;
  }

  return (
    odds.find((item) =>
      readTrimmedString(item.provider?.name)?.toLowerCase().includes("draft kings"),
    ) ??
    odds[0] ??
    null
  );
}

function readEspnSpread(
  odds: EspnScoreboardCompetition["odds"],
  homeAway: "away" | "home",
) {
  const preferredOdds = readPreferredEspnOdds(odds);
  const spreadSelection =
    homeAway === "away"
      ? preferredOdds?.pointSpread?.away?.close
      : preferredOdds?.pointSpread?.home?.close;

  return {
    spread: formatSpreadValue(spreadSelection?.line),
    spreadOdds: normalizeOddsString(spreadSelection?.odds),
  };
}

function readPreferredEspnEventUrl(event: EspnScoreboardEvent) {
  const links = Array.isArray(event.links) ? event.links : [];

  for (const preferredRel of ["gamecast", "summary", "boxscore", "recap", "event"]) {
    const matchingLink = links.find((link) =>
      Array.isArray(link.rel) ? link.rel.includes(preferredRel) : false,
    );

    const href = normalizeEspnUrl(matchingLink?.href);

    if (href) {
      return href;
    }
  }

  return normalizeEspnUrl(links[0]?.href);
}

function normalizeEspnGame(
  event: EspnScoreboardEvent,
  leagueAbbreviation: string,
): TopGame | null {
  const id = readTrimmedString(event.id);
  const startTime = readTrimmedString(event.date);
  const competition = Array.isArray(event.competitions) ? event.competitions[0] : null;
  const statusType = competition?.status?.type ?? event.status?.type ?? null;
  const state = readTrimmedString(statusType?.state)?.toLowerCase();

  if (
    !id ||
    !startTime ||
    Number.isNaN(Date.parse(startTime)) ||
    (state !== "pre" && state !== "in" && state !== "post")
  ) {
    return null;
  }

  const competitors = Array.isArray(competition?.competitors) ? competition?.competitors : [];
  const awayCompetitor = readEspnCompetitor(competitors, "away");
  const homeCompetitor = readEspnCompetitor(competitors, "home");
  const awayTeam = readEspnTeam(awayCompetitor);
  const homeTeam = readEspnTeam(homeCompetitor);

  if (!awayTeam || !homeTeam) {
    return null;
  }

  const awaySpread = readEspnSpread(competition?.odds, "away");
  const homeSpread = readEspnSpread(competition?.odds, "home");
  const preferredUrl = readPreferredEspnEventUrl(event);
  const normalizedState = state as TopGameState;

  return {
    id: `espn-${leagueAbbreviation.toLowerCase()}-${id}`,
    league: leagueAbbreviation,
    provider: "ESPN",
    startTime,
    status: {
      state: normalizedState,
      detail:
        readTrimmedString(statusType?.detail) ??
        (normalizedState === "post" ? "Final" : normalizedState === "in" ? "Live" : "Scheduled"),
      shortDetail:
        readTrimmedString(statusType?.shortDetail) ??
        (normalizedState === "post" ? "Final" : normalizedState === "in" ? "Live" : "Scheduled"),
      isComplete: normalizedState === "post",
    },
    away: {
      ...awayTeam,
      spread: normalizedState === "post" ? null : awaySpread.spread,
      spreadOdds: normalizedState === "post" ? null : awaySpread.spreadOdds,
    },
    home: {
      ...homeTeam,
      spread: normalizedState === "post" ? null : homeSpread.spread,
      spreadOdds: normalizedState === "post" ? null : homeSpread.spreadOdds,
    },
    gameUrl: preferredUrl,
    scoreboardUrl: preferredUrl,
  } satisfies TopGame;
}

export function parseTopGamesFromEspnScoreboardPayload(
  payload: EspnScoreboardPayload,
  fallbackLeagueAbbreviation: string,
) {
  if (!Array.isArray(payload.events)) {
    return [];
  }

  const leagueAbbreviation =
    readTrimmedString(payload.leagues?.[0]?.abbreviation) ?? fallbackLeagueAbbreviation;

  return payload.events
    .map((event) => normalizeEspnGame(event, leagueAbbreviation))
    .filter((game): game is TopGame => game !== null);
}

export async function fetchCompletedTopGamesForDate(
  dateKey = getTopGamesDateKey(),
  limit = 10,
) {
  const scoreboardDate = dateKey.replaceAll("-", "");
  const completedItems: TopGame[] = [];

  await Promise.all(
    ESPN_SCOREBOARD_CONFIGS.map(async ({ sport, leagueSlug, leagueAbbreviation }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort("timeout"), TOP_GAMES_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${ESPN_SITE_API_BASE_URL}/apis/site/v2/sports/${sport}/${leagueSlug}/scoreboard?dates=${scoreboardDate}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0",
            },
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as EspnScoreboardPayload;
        completedItems.push(
          ...parseTopGamesFromEspnScoreboardPayload(payload, leagueAbbreviation).filter(
            (game) => game.status.state === "post",
          ),
        );
      } catch {
        // Ignore individual scoreboard failures so the top bar can still load.
      } finally {
        clearTimeout(timeoutId);
      }
    }),
  );

  return orderTopGamesForTicker(collectCompletedTopGames(completedItems)).slice(0, limit);
}

export async function fetchTopGames(limit = 10, dateKey = getTopGamesDateKey()) {
  const scoreboardDate = dateKey.replaceAll("-", "");
  const items: TopGame[] = [];

  await Promise.all(
    ESPN_SCOREBOARD_CONFIGS.map(async ({ sport, leagueSlug, leagueAbbreviation }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort("timeout"), TOP_GAMES_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${ESPN_SITE_API_BASE_URL}/apis/site/v2/sports/${sport}/${leagueSlug}/scoreboard?dates=${scoreboardDate}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0",
            },
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as EspnScoreboardPayload;
        items.push(...parseTopGamesFromEspnScoreboardPayload(payload, leagueAbbreviation));
      } catch {
        // Ignore individual scoreboard failures so other leagues can still load.
      } finally {
        clearTimeout(timeoutId);
      }
    }),
  );

  const orderedItems = orderTopGamesForTicker(
    mergeTopGamesWithCompleted(
      items.filter((item) => item.status.state !== "post"),
      items.filter((item) => item.status.state === "post"),
    ),
  ).slice(0, limit);

  if (orderedItems.length === 0) {
    throw new TopGamesRequestError("Unable to load today’s DraftKings games.", 502);
  }

  return {
    items: orderedItems,
    provider: "DraftKings",
    source: TOP_GAMES_SOURCE,
    fetchedAt: new Date().toISOString(),
  } satisfies TopGamesResponse;
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
      (item.provider === "DraftKings" || item.provider === "ESPN") &&
      readTrimmedString(item.away.abbreviation) !== null &&
      readTrimmedString(item.home.abbreviation) !== null &&
      readTrimmedString(item.status.detail) !== null &&
      readTrimmedString(item.status.shortDetail) !== null
    );
  });
}
