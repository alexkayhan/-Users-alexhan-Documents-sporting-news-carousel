import type { Story } from "@/lib/types";

export const mockStories: Story[] = [
  {
    id: "buzzer-beater-ot",
    headline: "Harbor City steals overtime thriller on a step-back at the horn",
    summary:
      "A late trap forced the turnover, and the Waves turned it into a coast-to-coast winner that flipped the playoff race in the final four seconds.",
    content:
      "Harbor City closed on a 9-1 burst, forced the decisive turnover near midcourt, and used the final timeout to spring a sideline action that freed its top scorer for the winner.",
    source: "Center Court Daily",
    author: "Jules Carter",
    publishedAt: "2026-03-27T08:15:00.000Z",
    tag: "Basketball",
    url: "https://example.com/stories/buzzer-beater-ot",
    image: {
      src: "/mock-images/basketball-buzzer.svg",
      alt: "Basketball court graphic with a final-shot countdown.",
      fallbackSrc: "/mock-images/basketball-buzzer.svg",
    },
  },
  {
    id: "derby-breakaway",
    headline: "Metro United runs wild down the left in a derby decided by pace",
    summary:
      "Three direct transitions exposed the back line, and a 19-year-old winger delivered the clinching assist in front of a packed away end.",
    content:
      "United repeatedly attacked the same channel after halftime, stretching the fullback with diagonal runs before the winning cutback arrived in the 82nd minute.",
    source: "Touchline Report",
    author: "Amira Doyle",
    publishedAt: "2026-03-27T07:02:00.000Z",
    tag: "Football",
    url: "https://example.com/stories/derby-breakaway",
    image: {
      src: "/mock-images/football-breakaway.svg",
      alt: "Soccer pitch graphic highlighting a sprinting winger and attack lane.",
      fallbackSrc: "/mock-images/football-breakaway.svg",
    },
  },
  {
    id: "photo-finish-mile",
    headline: "Track final comes down to a lean as rivals match strides for 1600 meters",
    summary:
      "Split times stayed even all race long before the last bend opened into a photo finish that coaches were still replaying an hour later.",
    content:
      "The leaders covered the final lap shoulder to shoulder before a perfectly timed lean at the line decided the event by the thinnest margin on the photo system.",
    source: "Lap Split News",
    author: "Chris Mendoza",
    publishedAt: "2026-03-27T06:41:00.000Z",
    tag: "Track",
    url: "https://example.com/stories/photo-finish-mile",
    image: {
      src: "/mock-images/track-photo-finish.svg",
      alt: "Running track graphic with two runners crossing a finish line together.",
      fallbackSrc: "/mock-images/track-photo-finish.svg",
    },
  },
  {
    id: "pit-wall-gamble",
    headline: "Pit wall gamble pays off as late soft tires rewrite the podium",
    summary:
      "A short final stint turned into the move of the day, with fresh rubber helping the leader cut through traffic before the checkered flag.",
    content:
      "The undercut looked risky at first, but the fresh compound came alive immediately and delivered enough pace to overturn two places in the closing laps.",
    source: "Pole Position Wire",
    author: "Sofia Barrett",
    publishedAt: "2026-03-27T05:28:00.000Z",
    tag: "Motorsport",
    url: "https://example.com/stories/pit-wall-gamble",
    image: {
      src: "/mock-images/motorsport-pit-stop.svg",
      alt: "Race car graphic with pit lane markers and tire strategy lines.",
      fallbackSrc: "/mock-images/motorsport-pit-stop.svg",
    },
  },
  {
    id: "sudden-death-save",
    headline: "Rangers survive sudden death after a glove save that froze the arena",
    summary:
      "The deciding penalty kill looked broken twice, but the goaltender erased both chances and set up a game-winning counterattack moments later.",
    content:
      "Two backdoor looks appeared to end the game before the goaltender's glove save shifted the momentum and sparked the transition that finished the contest.",
    source: "Blue Line Brief",
    author: "Noah Pike",
    publishedAt: "2026-03-27T04:12:00.000Z",
    tag: "Hockey",
    url: "https://example.com/stories/sudden-death-save",
    image: {
      src: "/mock-images/hockey-glove-save.svg",
      alt: "Ice rink graphic with a goalie glove save highlighted near the crease.",
      fallbackSrc: "/mock-images/hockey-glove-save.svg",
    },
  },
];
