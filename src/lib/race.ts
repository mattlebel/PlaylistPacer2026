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

/** How many songs fit on one mile marker: about a mile of music at a typical marathon pace. */
export const SONGS_PER_MILE = 3;

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
  { n: 0, d: 0, title: "The start", note: "Staten Island. A howitzer instead of a starting gun, then Sinatra’s “New York, New York.”", landmark: true },
  { n: 1, d: at(1), title: "Top of the Verrazzano", note: "The longest hill in the race and the highest point, with Lady Liberty off to the left.", landmark: true },
  { n: 2, d: at(2), title: "Into Brooklyn", note: "All downhill off the bridge, usually a minute faster than goal pace." },
  { n: 3, d: at(3), title: "Bay Ridge", note: "Fort Hamilton on the right, the first water stop, and the start of Fourth Avenue." },
  { n: 4, d: at(4), title: "Sunset Park", note: "Brooklyn’s Chinatown, with Green-Wood Cemetery off to the right." },
  { n: 5, d: at(5), title: "Fourth Avenue", note: "A flat straightaway. Get into a groove." },
  { n: 6, d: at(6), title: "South Slope", note: "Fourth Avenue keeps going. So do you." },
  { n: 7, d: at(7), title: "Park Slope", note: "The bank tower you’ve been aiming at is getting close." },
  { n: 8, d: at(8), title: "Barclays & the Bank Tower", note: "Barclays Center, the Williamsburg Savings Bank Tower and BAM. All three starts merge here.", landmark: true },
  { n: 9, d: at(9), title: "Bed-Stuy", note: "Onto Lafayette Avenue, where the Bishop Loughlin band plays Rocky all race long." },
  { n: 10, d: at(10), title: "Williamsburg", note: "Neighbors often hand out orange slices." },
  { n: 11, d: at(11), title: "Bedford Avenue", note: "The Williamsburg Bridge on the left, then the first energy gels." },
  { n: 12, d: at(12), title: "Greenpoint", note: "New York’s largest Polish community. Halfway is almost here." },
  { n: 13, d: at(13), title: "Pulaski Bridge · Halfway", note: "13.1 miles on a gentle climb, then into Queens.", landmark: true },
  { n: 14, d: at(14), title: "Long Island City", note: "A quick mile through Queens, borough number 3." },
  { n: 15, d: at(15), title: "Queensboro Bridge", note: "The toughest hill on the course. No crowds, just breathing and footsteps.", landmark: true },
  { n: 16, d: at(16), title: "First Avenue", note: "Off the bridge into crowds ten deep. Don’t let them pull you too fast.", landmark: true },
  { n: 17, d: at(17), title: "Upper East Side", note: "First Avenue: flat, packed, and loud." },
  { n: 18, d: at(18), title: "East Harlem", note: "El Barrio, at the top of First Avenue." },
  { n: 19, d: at(19), title: "Willis Avenue Bridge", note: "A nearly flat bridge into the Bronx, borough number 5." },
  { n: 20, d: at(20), title: "The Bronx", note: "The real halfway point of a marathon. Yankee Stadium on the right.", landmark: true },
  { n: 21, d: at(21), title: "Madison Avenue Bridge", note: "Back into Harlem, where fans come straight from church." },
  { n: 22, d: at(22), title: "Marcus Garvey Park", note: "A loop around the park. Those trees aren’t Central Park yet." },
  { n: 23, d: at(23), title: "Fifth Avenue hill", note: "Museum Mile: a mile-long climb in the worst possible place.", landmark: true },
  { n: 24, d: at(24), title: "Central Park", note: "Through Engineers’ Gate, down Cat Hill, past the Met." },
  { n: 25, d: at(25), title: "Central Park South", note: "Out of the park and along 59th Street, where Wrong-Way Silva took his detour." },
  { n: 26, d: at(26), title: "The finish", note: "Columbus Circle, back into the park, two little hills, and Tavern on the Green.", landmark: true },
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
