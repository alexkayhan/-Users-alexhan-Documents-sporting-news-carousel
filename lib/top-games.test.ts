import { describe, expect, it } from "vitest";
import {
  formatTopGameStartTime,
  formatScoreSummary,
  formatSpreadSummary,
  getTopGameLink,
  parseTopGamesFromEspnOddsHtml,
  shouldShowFinalScore,
} from "@/lib/top-games";

function buildTopOddsHtml() {
  const payload = {
    page: {
      content: {
        odds: {
          providerName: "draftkings",
          odds: [
            {
              displayValue: "NBA",
              lines: [
                {
                  id: "game-pre",
                  date: "2026-03-30T23:00:00.000Z",
                  status: {
                    type: {
                      state: "pre",
                      detail: "Mon, March 30th at 7:00 PM EDT",
                      shortDetail: "7:00 PM",
                    },
                  },
                  competitors: [
                    {
                      homeAway: "home",
                      score: null,
                      team: {
                        abbreviation: "MIA",
                        displayName: "Miami Heat",
                      },
                    },
                    {
                      homeAway: "away",
                      score: null,
                      team: {
                        abbreviation: "PHI",
                        displayName: "Philadelphia 76ers",
                      },
                    },
                  ],
                  odds: [
                    {
                      provider: {
                        displayName: "DraftKings",
                      },
                      pointSpread: {
                        home: {
                          close: {
                            line: "+2.5",
                            odds: "-118",
                          },
                        },
                        away: {
                          close: {
                            line: "-2.5",
                            odds: "-102",
                          },
                        },
                      },
                    },
                  ],
                  links: [
                    {
                      rel: ["summary", "desktop", "event"],
                      href: "/nba/game/_/gameId/game-pre",
                    },
                  ],
                  gameOdd: {
                    gameBetLink: "https://sportsbook.draftkings.com/gateway?event=game-pre",
                  },
                },
                {
                  id: "game-live",
                  date: "2026-03-30T20:00:00.000Z",
                  status: {
                    type: {
                      state: "in",
                      detail: "Q3 04:21",
                      shortDetail: "Q3 4:21",
                    },
                  },
                  competitors: [
                    {
                      homeAway: "home",
                      score: "82",
                      team: {
                        abbreviation: "ATL",
                        displayName: "Atlanta Hawks",
                      },
                    },
                    {
                      homeAway: "away",
                      score: "87",
                      team: {
                        abbreviation: "BOS",
                        displayName: "Boston Celtics",
                      },
                    },
                  ],
                  odds: [
                    {
                      provider: {
                        displayName: "DraftKings",
                      },
                      pointSpread: {
                        home: {
                          close: {
                            line: "-2.5",
                            odds: "-110",
                          },
                        },
                        away: {
                          close: {
                            line: "+2.5",
                            odds: "-110",
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  id: "game-final",
                  date: "2026-03-30T17:00:00.000Z",
                  status: {
                    type: {
                      state: "post",
                      completed: true,
                      detail: "Final",
                      shortDetail: "Final",
                    },
                  },
                  competitors: [
                    {
                      homeAway: "home",
                      score: 98,
                      team: {
                        abbreviation: "DAL",
                        displayName: "Dallas Mavericks",
                      },
                    },
                    {
                      homeAway: "away",
                      score: 102,
                      team: {
                        abbreviation: "MIN",
                        displayName: "Minnesota Timberwolves",
                      },
                    },
                  ],
                  odds: [
                    {
                      provider: {
                        displayName: "DraftKings",
                      },
                      pointSpread: {
                        home: {
                          close: {
                            line: "+7.5",
                            odds: "-102",
                          },
                        },
                        away: {
                          close: {
                            line: "-7.5",
                            odds: "-118",
                          },
                        },
                      },
                    },
                  ],
                  links: [
                    {
                      rel: ["summary", "desktop", "event"],
                      href: "/nba/game/_/gameId/game-final",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  };

  return `<html><body><script>window['__espnfitt__']=${JSON.stringify(payload)};</script></body></html>`;
}

describe("parseTopGamesFromEspnOddsHtml", () => {
  it("normalizes scheduled, live, and final DraftKings games from ESPN", () => {
    const payload = parseTopGamesFromEspnOddsHtml(buildTopOddsHtml(), 5);

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
        shortDetail: "7:00 PM",
      },
      gameUrl: "https://sportsbook.draftkings.com/gateway?event=game-pre",
      scoreboardUrl: "https://www.espn.com/nba/game/_/gameId/game-pre",
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
    const [scheduledGame, liveGame, finalGame] = parseTopGamesFromEspnOddsHtml(
      buildTopOddsHtml(),
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
      "https://www.espn.com/nba/game/_/gameId/game-final",
    );
  });

  it("throws when the ESPN payload is missing", () => {
    expect(() => parseTopGamesFromEspnOddsHtml("<html></html>", 5)).toThrow(
      "Unable to locate the DraftKings odds payload.",
    );
  });
});
