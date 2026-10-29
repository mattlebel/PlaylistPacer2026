import { loadPreset } from "./courses";
import { METERS_PER_MILE } from "./geo";

/**
 * The one race Playlist Pacer supports for now: the 2026 NYC Marathon.
 * Sunday, November 1, 2026. Daylight saving ends at 2am that morning, so the race runs on EST.
 */
export const RACE = {
  id: "nyc-2026",
  name: "NYC Marathon",
  date: "2026-11-01",
  dateLabel: "Sunday, November 1, 2026",
  utcOffset: "-05:00",
  timeZone: "America/New_York",
  courseId: "nyc-marathon",
  distance: 42195,
} as const;

/** How many songs fit on one mile marker. */
export const SONGS_PER_MILE = 4;

/** Adding songs closes at 6am race morning, so the runner can save the final playlist before heading out. */
export const ADDING_CLOSES_AT = new Date(`${RACE.date}T06:00:00${RACE.utcOffset}`);

export interface Mile {
  /** 0 is the start; songs on marker N play from mile N onward, in order. */
  n: number;
  /** Meters from the start. */
  d: number;
  /** Short name for the spot, e.g. "Queensboro Bridge". */
  title: string;
  /** One line about what's happening around this marker. */
  note: string;
  /** Big moments get a star on the map. */
  landmark?: boolean;
}

const LAST = RACE.distance;
const at = (n: number) => Math.min(Math.round(n * METERS_PER_MILE), LAST);

/** Positions checked against the real GPS track in tests/unit/courses.test.ts. */
export const MILES: Mile[] = [
  { n: 0, d: 0, title: "The start", note: "Fort Wadsworth, Staten Island. The cannon, Sinatra, and the climb onto the bridge.", landmark: true },
  { n: 1, d: at(1), title: "Top of the Verrazzano", note: "The highest point on the course, with Manhattan on the horizon.", landmark: true },
  { n: 2, d: at(2), title: "Into Brooklyn", note: "Off the bridge into Bay Ridge and the first real crowds." },
  { n: 3, d: at(3), title: "Fourth Avenue, Bay Ridge", note: "The start of a long, flat, loud run up Fourth Avenue." },
  { n: 4, d: at(4), title: "Sunset Park", note: "Still on Fourth Avenue. Find your pace and hold it." },
  { n: 5, d: at(5), title: "Sunset Park", note: "Bands and block parties on every other corner." },
  { n: 6, d: at(6), title: "South Slope", note: "Fourth Avenue keeps going. So do you." },
  { n: 7, d: at(7), title: "Park Slope", note: "Some of the biggest crowds in Brooklyn." },
  { n: 8, d: at(8), title: "Barclays Center & Lafayette Ave", note: "Past Barclays and onto Lafayette Avenue, the loudest block in Brooklyn.", landmark: true },
  { n: 9, d: at(9), title: "Clinton Hill", note: "Lafayette Avenue, with drum lines and brownstone stoops full of people." },
  { n: 10, d: at(10), title: "Williamsburg", note: "Onto Bedford Avenue. A quieter stretch where your music carries you." },
  { n: 11, d: at(11), title: "Bedford Avenue", note: "North Williamsburg. The crowds come back." },
  { n: 12, d: at(12), title: "Greenpoint", note: "The last of Brooklyn. Halfway is almost here." },
  { n: 13, d: at(13), title: "Pulaski Bridge · Halfway", note: "13.1 miles at the top of the bridge, then into Queens.", landmark: true },
  { n: 14, d: at(14), title: "Long Island City", note: "A quick mile through Queens." },
  { n: 15, d: at(15), title: "Queensboro Bridge", note: "No crowds, just footsteps. The song you pick here matters most.", landmark: true },
  { n: 16, d: at(16), title: "First Avenue", note: "Off the bridge into a wall of sound.", landmark: true },
  { n: 17, d: at(17), title: "Upper East Side", note: "First Avenue, packed on both sides." },
  { n: 18, d: at(18), title: "East Harlem", note: "Still on First Avenue. The race starts to get real." },
  { n: 19, d: at(19), title: "Willis Avenue Bridge", note: "The last stretch of First Avenue, then up and over into the Bronx." },
  { n: 20, d: at(20), title: "The Bronx", note: "Mile 20. The wall lives around here.", landmark: true },
  { n: 21, d: at(21), title: "Madison Avenue Bridge", note: "Back to Manhattan for good." },
  { n: 22, d: at(22), title: "Harlem", note: "Fifth Avenue past Marcus Garvey Park." },
  { n: 23, d: at(23), title: "Fifth Avenue hill", note: "The long, sneaky climb along Central Park.", landmark: true },
  { n: 24, d: at(24), title: "Central Park", note: "Into the park and down East Drive, past the Met." },
  { n: 25, d: at(25), title: "Central Park South", note: "Down East Drive, then out onto 59th Street toward Columbus Circle." },
  { n: 26, d: at(26), title: "The finish", note: "Back into the park for the last 0.2 miles to Tavern on the Green.", landmark: true },
];

export const mileByN = (n: number) => MILES.find((m) => m.n === n);

export const mileLabel = (n: number) => (n === 0 ? "Start" : `Mile ${n}`);

let course: ReturnType<typeof loadPreset> | null = null;
export function raceCourse() {
  course ??= loadPreset(RACE.courseId);
  return course;
}

export function fmtTimeOfDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: RACE.timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

/**
 * The first version of the app had 16 named "moments" with one song each. Songs planted
 * there move to the mile marker at or just before that moment.
 */
export const LEGACY_MOMENT_MILE: Record<string, number> = {
  start: 0,
  brooklyn: 2,
  "5k": 3,
  "10k": 6,
  lafayette: 8,
  williamsburg: 11,
  half: 13,
  queensboro: 15,
  "first-ave": 16,
  "30k": 18,
  bronx: 20,
  madison: 21,
  "fifth-ave": 23,
  "central-park": 24,
  "40k": 24,
  finish: 25,
};
