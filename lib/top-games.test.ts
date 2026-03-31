import { describe, expect, it } from "vitest";
import {
  collectCompletedTopGames,
  parseTopGamesFromEspnScoreboardPayload,
  formatTopGameStartTime,
  formatScoreSummary,
  formatSpreadSummary,
  getTopGameLink,
  mergeTopGamesWithCompleted,
  parseTopGamesFromDraftKingsLivePayload,
  shouldShowFinalScore,
} from "@/lib/top-games";

function buildDraftKingsLivePayload() {
  return {
    sections: [
      {
        id: "42648",
        name: "NBA",
        sortOrder: 100,
        associatedData: {
          seoIdentifier: "nba",
        },
      },
    ],
    events: [
      {
        id: "game-pre",
        seoIdentifier: "phi-76ers-%40-mia-heat",
        leagueId: "42648",
        startEventDate: "2026-03-30T23:00:00.000Z",
        status: "NOT_STARTED",
        sortOrder: 1,
        participants: [
          {
            id: "home-pre",
            name: "Miami Heat",
            venueRole: "Home",
            metadata: {
              shortName: "MIA",
            },
          },
          {
            id: "away-pre",
            name: "Philadelphia 76ers",
            venueRole: "Away",
            metadata: {
              shortName: "PHI",
            },
          },
        ],
        eventScore: {
          mainScore: {
            homeScore: null,
            awayScore: null,
          },
        },
      },
      {
        id: "game-live",
        seoIdentifier: "bos-celtics-%40-atl-hawks",
        leagueId: "42648",
        startEventDate: "2026-03-30T20:00:00.000Z",
        status: "STARTED",
        sortOrder: 2,
        liveGameState: {
          period: "Q3",
          gameTime: 261,
        },
        participants: [
          {
            id: "home-live",
            name: "Atlanta Hawks",
            venueRole: "Home",
            metadata: {
              shortName: "ATL",
            },
          },
          {
            id: "away-live",
            name: "Boston Celtics",
            venueRole: "Away",
            metadata: {
              shortName: "BOS",
            },
          },
        ],
        eventScore: {
          mainScore: {
            homeScore: "82",
            awayScore: "87",
          },
        },
      },
      {
        id: "game-final",
        seoIdentifier: "min-timberwolves-%40-dal-mavericks",
        leagueId: "42648",
        startEventDate: "2026-03-30T17:00:00.000Z",
        status: "FINAL",
        sortOrder: 3,
        participants: [
          {
            id: "home-final",
            name: "Dallas Mavericks",
            venueRole: "Home",
            metadata: {
              shortName: "DAL",
            },
          },
          {
            id: "away-final",
            name: "Minnesota Timberwolves",
            venueRole: "Away",
            metadata: {
              shortName: "MIN",
            },
          },
        ],
        eventScore: {
          mainScore: {
            homeScore: 98,
            awayScore: 102,
          },
        },
      },
    ],
    markets: [
      {
        id: "spread-pre",
        eventId: "game-pre",
        name: "Spread",
        marketType: {
          betOfferTypeId: 1,
          name: "Spread",
        },
      },
      {
        id: "spread-live",
        eventId: "game-live",
        name: "Spread",
        marketType: {
          betOfferTypeId: 1,
          name: "Spread",
        },
      },
      {
        id: "spread-final",
        eventId: "game-final",
        name: "Spread",
        marketType: {
          betOfferTypeId: 1,
          name: "Spread",
        },
      },
    ],
    selections: [
      {
        id: "pre-away",
        marketId: "spread-pre",
        points: -2.5,
        displayOdds: {
          american: "-102",
        },
        outcomeType: "Away",
        participants: [
          {
            name: "Philadelphia 76ers",
            venueRole: "Away",
          },
        ],
      },
      {
        id: "pre-home",
        marketId: "spread-pre",
        points: 2.5,
        displayOdds: {
          american: "-118",
        },
        outcomeType: "Home",
        participants: [
          {
            name: "Miami Heat",
            venueRole: "Home",
          },
        ],
      },
      {
        id: "live-away",
        marketId: "spread-live",
        points: 2.5,
        displayOdds: {
          american: "-110",
        },
        outcomeType: "Away",
        participants: [
          {
            name: "Boston Celtics",
            venueRole: "Away",
          },
        ],
      },
      {
        id: "live-home",
        marketId: "spread-live",
        points: -2.5,
        displayOdds: {
          american: "-110",
        },
        outcomeType: "Home",
        participants: [
          {
            name: "Atlanta Hawks",
            venueRole: "Home",
          },
        ],
      },
      {
        id: "final-away",
        marketId: "spread-final",
        points: -7.5,
        displayOdds: {
          american: "-118",
        },
        outcomeType: "Away",
        participants: [
          {
            name: "Minnesota Timberwolves",
            venueRole: "Away",
          },
        ],
      },
      {
        id: "final-home",
        marketId: "spread-final",
        points: 7.5,
        displayOdds: {
          american: "-102",
        },
        outcomeType: "Home",
        participants: [
          {
            name: "Dallas Mavericks",
            venueRole: "Home",
          },
        ],
      },
    ],
  };
}

function buildEspnCompletedScoreboardPayload() {
  return {
    leagues: [
      {
        abbreviation: "MLB",
      },
    ],
    events: [
      {
        id: "401814700",
        date: "2026-03-30T17:10:00.000Z",
        links: [
          {
            rel: ["recap", "desktop", "event"],
            href: "https://www.espn.com/mlb/recap/_/gameId/401814700",
          },
        ],
        competitions: [
          {
            competitors: [
              {
                homeAway: "away",
                score: "2",
                team: {
                  abbreviation: "NYY",
                  displayName: "New York Yankees",
                },
              },
              {
                homeAway: "home",
                score: "5",
                team: {
                  abbreviation: "BOS",
                  displayName: "Boston Red Sox",
                },
              },
            ],
            status: {
              type: {
                state: "post",
                completed: true,
                detail: "Final",
                shortDetail: "Final",
              },
            },
          },
        ],
      },
    ],
  };
}

function buildEspnTopGamesScoreboardPayload() {
  return {
    leagues: [
      {
        abbreviation: "NBA",
      },
    ],
    events: [
      {
        id: "401810946",
        date: "2026-03-31T02:00:00.000Z",
        links: [
          {
            rel: ["gamecast", "desktop", "event"],
            href: "https://www.espn.com/nba/game/_/gameId/401810946",
          },
        ],
        competitions: [
          {
            competitors: [
              {
                homeAway: "away",
                score: "112",
                team: {
                  abbreviation: "PHI",
                  displayName: "Philadelphia 76ers",
                },
              },
              {
                homeAway: "home",
                score: "114",
                team: {
                  abbreviation: "MIA",
                  displayName: "Miami Heat",
                },
              },
            ],
            odds: [
              {
                provider: {
                  name: "Draft Kings",
                },
                pointSpread: {
                  away: {
                    close: {
                      line: "+1.5",
                      odds: "-105",
                    },
                  },
                  home: {
                    close: {
                      line: "-1.5",
                      odds: "-115",
                    },
                  },
                },
              },
            ],
            status: {
              displayClock: "1:23",
              period: 4,
              type: {
                state: "in",
                completed: false,
                detail: "4th Quarter 1:23",
                shortDetail: "Q4 1:23",
              },
            },
          },
        ],
      },
      {
        id: "401810947",
        date: "2026-03-31T04:30:00.000Z",
        links: [
          {
            rel: ["gamecast", "desktop", "event"],
            href: "https://www.espn.com/nba/game/_/gameId/401810947",
          },
        ],
        competitions: [
          {
            competitors: [
              {
                homeAway: "away",
                score: null,
                team: {
                  abbreviation: "BOS",
                  displayName: "Boston Celtics",
                },
              },
              {
                homeAway: "home",
                score: null,
                team: {
                  abbreviation: "ATL",
                  displayName: "Atlanta Hawks",
                },
              },
            ],
            odds: [
              {
                provider: {
                  name: "Draft Kings",
                },
                pointSpread: {
                  away: {
                    close: {
                      line: "-2.5",
                      odds: "-110",
                    },
                  },
                  home: {
                    close: {
                      line: "+2.5",
                      odds: "-110",
                    },
                  },
                },
              },
            ],
            status: {
              displayClock: "0:00",
              period: 0,
              type: {
                state: "pre",
                completed: false,
                detail: "Scheduled",
                shortDetail: "Scheduled",
              },
            },
          },
        ],
      },
    ],
  };
}

describe("parseTopGamesFromDraftKingsLivePayload", () => {
  it("normalizes scheduled, live, and final DraftKings games", () => {
    const payload = parseTopGamesFromDraftKingsLivePayload(
      buildDraftKingsLivePayload(),
      5,
    );

    expect(payload.provider).toBe("DraftKings");
    expect(payload.items).toHaveLength(3);

    expect(payload.items[0]).toMatchObject({
      id: "game-pre",
      league: "NBA",
      away: {
        abbreviation: "PHI",
        spread: "-2.5",
      },
      home: {
        abbreviation: "MIA",
        spread: "+2.5",
      },
      status: {
        state: "pre",
        shortDetail: "Scheduled",
      },
      gameUrl: "https://sportsbook.draftkings.com/event/phi-76ers-%40-mia-heat/game-pre",
    });

    expect(payload.items[1]).toMatchObject({
      id: "game-live",
      status: {
        state: "in",
        shortDetail: "Q3 4:21",
      },
      away: {
        score: "87",
      },
      home: {
        score: "82",
      },
    });

    expect(payload.items[2]).toMatchObject({
      id: "game-final",
      status: {
        state: "post",
        isComplete: true,
      },
    });
  });

  it("supports the ticker formatting helpers", () => {
    const [scheduledGame, liveGame, finalGame] = parseTopGamesFromDraftKingsLivePayload(
      buildDraftKingsLivePayload(),
      5,
    ).items;

    expect(formatSpreadSummary(scheduledGame)).toBe("PHI -2.5 • MIA +2.5");
    expect(formatScoreSummary(liveGame)).toBe("87 - 82");
    expect(shouldShowFinalScore(finalGame)).toBe(true);
    expect(
      formatTopGameStartTime(scheduledGame.startTime, {
        locale: "en-US",
        timeZone: "America/Los_Angeles",
      }),
    ).toContain("PDT");
    expect(getTopGameLink(finalGame)).toBe(
      "https://sportsbook.draftkings.com/event/min-timberwolves-%40-dal-mavericks/game-final",
    );
  });

  it("parses completed ESPN scoreboard games into final chips", () => {
    const [game] = parseTopGamesFromEspnScoreboardPayload(
      buildEspnCompletedScoreboardPayload(),
      "MLB",
    );

    expect(game).toMatchObject({
      league: "MLB",
      provider: "ESPN",
      status: {
        state: "post",
        isComplete: true,
        shortDetail: "Final",
      },
      away: {
        abbreviation: "NYY",
        score: "2",
      },
      home: {
        abbreviation: "BOS",
        score: "5",
      },
      gameUrl: "https://www.espn.com/mlb/recap/_/gameId/401814700",
    });
  });

  it("parses ESPN scoreboard games with DraftKings spreads for live and scheduled matchups", () => {
    const [liveGame, scheduledGame] = parseTopGamesFromEspnScoreboardPayload(
      buildEspnTopGamesScoreboardPayload(),
      "NBA",
    );

    expect(liveGame).toMatchObject({
      provider: "ESPN",
      league: "NBA",
      status: {
        state: "in",
        shortDetail: "Q4 1:23",
      },
      away: {
        abbreviation: "PHI",
        spread: "+1.5",
      },
      home: {
        abbreviation: "MIA",
        spread: "-1.5",
      },
    });

    expect(scheduledGame).toMatchObject({
      status: {
        state: "pre",
        shortDetail: "Scheduled",
      },
      away: {
        abbreviation: "BOS",
        spread: "-2.5",
      },
      home: {
        abbreviation: "ATL",
        spread: "+2.5",
      },
    });
  });

  it("throws when the DraftKings payload is missing core arrays", () => {
    expect(() =>
      parseTopGamesFromDraftKingsLivePayload(
        {
          sections: [],
        },
        5,
      ),
    ).toThrow("Unable to read the DraftKings live board.");
  });

  it("appends same-day completed games after the current board without duplicating them", () => {
    const [scheduledGame, liveGame, finalGame] = parseTopGamesFromDraftKingsLivePayload(
      buildDraftKingsLivePayload(),
      5,
    ).items;

    const [espnCompletedGame] = parseTopGamesFromEspnScoreboardPayload(
      buildEspnCompletedScoreboardPayload(),
      "MLB",
    );

    const duplicateCompletedGame = {
      ...finalGame,
      id: "espn-duplicate-final",
      provider: "ESPN" as const,
    };

    const mergedItems = mergeTopGamesWithCompleted(
      [scheduledGame, liveGame, finalGame],
      [duplicateCompletedGame, espnCompletedGame],
    );

    expect(mergedItems.map((item) => item.id)).toEqual([
      "game-live",
      "game-pre",
      "espn-mlb-401814700",
      "game-final",
    ]);

    expect(collectCompletedTopGames(mergedItems).map((item) => item.id)).toEqual([
      "espn-mlb-401814700",
      "game-final",
    ]);
  });
});
