export type StoryTag =
  | "Baseball"
  | "Basketball"
  | "Football"
  | "Hockey"
  | "Motorsport"
  | "Track"
  | "Sports";

export type Story = {
  id: string;
  headline: string;
  summary: string;
  content: string;
  source: string;
  author: string | null;
  publishedAt: string;
  tag: StoryTag;
  url: string;
  image: {
    src: string;
    alt: string;
    fallbackSrc: string;
  };
  video?: {
    src: string;
    hlsSrc?: string | null;
    hasAudio?: boolean | null;
  } | null;
};

export type StoriesResponse = {
  items: Story[];
  page: number;
  pageSize: number;
  totalResults: number;
  hasMore: boolean;
  nextPage: number | null;
};

export type TopGameState = "pre" | "in" | "post";

export type TopGameTeam = {
  abbreviation: string;
  displayName: string;
  score: string | null;
  spread: string | null;
  spreadOdds: string | null;
};

export type TopGame = {
  id: string;
  league: string;
  provider: "DraftKings";
  startTime: string;
  away: TopGameTeam;
  home: TopGameTeam;
  status: {
    state: TopGameState;
    detail: string;
    shortDetail: string;
    isComplete: boolean;
  };
  gameUrl: string | null;
  scoreboardUrl: string | null;
};

export type TopGamesResponse = {
  items: TopGame[];
  provider: "DraftKings";
  source: string;
  fetchedAt: string;
};
