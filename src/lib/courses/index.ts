import { buildCourse, METERS_PER_MILE } from "../geo";
import type { Course, Landmark } from "../types";

/**
 * Hand-traced preset courses. They follow the real streets closely enough to plan
 * a playlist, but they're not certified routes: elevation is sketched from the
 * known hills, and distance is pinned to the official length.
 * Upload the official GPX if you want it exact.
 */
interface Preset {
  id: string;
  name: string;
  short: string;
  blurb: string;
  official: number;
  defaultGoal: number;
  emoji: string;
  /** [lat, lon] */
  path: [number, number][];
  /** [mile, meters] */
  ele: [number, number][];
  /** [mile, name, emoji, vibe] */
  landmarks: [number, string, string, string][];
}

const MI = METERS_PER_MILE;

const PRESETS: Preset[] = [
  {
    id: "nyc-marathon",
    name: "NYC Marathon",
    short: "26.2 · 5 boroughs",
    blurb: "Staten Island to Tavern on the Green. 2M screaming New Yorkers, one silent bridge.",
    official: 42195,
    defaultGoal: 4 * 3600,
    emoji: "🗽",
    path: [
      [40.6031, -74.0645], [40.6046, -74.0560], [40.6066, -74.0447], [40.6087, -74.0365],
      [40.6110, -74.0300], [40.6152, -74.0287], [40.6178, -74.0283], [40.6260, -74.0247],
      [40.6345, -74.0205], [40.6430, -74.0150], [40.6510, -74.0085], [40.6590, -74.0010],
      [40.6650, -73.9940], [40.6705, -73.9882], [40.6775, -73.9830], [40.6838, -73.9780],
      [40.6866, -73.9752], [40.6876, -73.9660], [40.6885, -73.9590], [40.6888, -73.9544],
      [40.6950, -73.9560], [40.7005, -73.9572], [40.7070, -73.9615], [40.7140, -73.9600],
      [40.7180, -73.9575], [40.7230, -73.9513], [40.7240, -73.9503], [40.7305, -73.9542],
      [40.7310, -73.9500], [40.7380, -73.9505], [40.7440, -73.9520], [40.7470, -73.9475],
      [40.7445, -73.9440], [40.7480, -73.9395], [40.7510, -73.9400], [40.7535, -73.9450],
      [40.7565, -73.9530], [40.7600, -73.9610], [40.7590, -73.9590], [40.7620, -73.9585],
      [40.7680, -73.9545], [40.7760, -73.9488], [40.7840, -73.9445], [40.7920, -73.9390],
      [40.7980, -73.9350], [40.8023, -73.9330], [40.8050, -73.9300], [40.8075, -73.9270],
      [40.8100, -73.9245], [40.8120, -73.9285], [40.8110, -73.9335], [40.8095, -73.9355],
      [40.8125, -73.9380], [40.8085, -73.9410], [40.8050, -73.9425], [40.8020, -73.9440],
      [40.7990, -73.9470], [40.7965, -73.9495], [40.7900, -73.9545], [40.7843, -73.9584],
      [40.7835, -73.9605], [40.7800, -73.9635], [40.7770, -73.9655], [40.7720, -73.9690],
      [40.7680, -73.9718], [40.7650, -73.9727], [40.7660, -73.9770], [40.7673, -73.9805],
      [40.7681, -73.9819], [40.7700, -73.9800], [40.7722, -73.9775],
    ],
    ele: [
      [0, 20], [0.5, 50], [1.0, 66], [1.6, 30], [2.1, 6], [3, 14], [5, 24], [7, 30], [8, 34],
      [9, 30], [11, 22], [12.6, 14], [13.1, 22], [13.4, 6], [14.5, 8], [15.0, 12], [15.6, 42],
      [16.1, 8], [17, 20], [18, 12], [19, 18], [19.6, 6], [20.0, 16], [20.4, 6], [21.0, 8],
      [21.2, 14], [21.5, 6], [22, 12], [23, 22], [23.6, 34], [24.0, 30], [24.4, 40], [25.0, 30],
      [25.6, 22], [26.0, 26], [26.22, 30],
    ],
    landmarks: [
      [0, "Verrazzano start", "🌉", "cannon fires, Sinatra plays. don't sprint the bridge."],
      [3.1, "Bay Ridge / 4th Ave", "📣", "Brooklyn is LOUD. easy money miles."],
      [8.3, "Lafayette Ave", "🥁", "the drum lines. a fan-fave stretch."],
      [11.2, "Williamsburg", "🕍", "quiet Hasidic section — inner-playlist time."],
      [13.1, "Pulaski Bridge", "🎯", "halfway. check your splits, not your phone."],
      [15.2, "Queensboro Bridge", "🤫", "no crowds, just footsteps. PUT AN ANTHEM HERE."],
      [16.2, "First Avenue", "🔊", "the wall of sound. try not to surge."],
      [20.0, "The Bronx", "🧱", "the wall lives here. emergency banger zone."],
      [23.0, "Fifth Ave hill", "⛰️", "the sneaky long climb to the park."],
      [24.3, "Cat Hill-ish / East Drive", "🐈‍⬛", "park rollers. dig."],
      [25.5, "Central Park South", "🏙️", "one mile to go. send it."],
      [26.2, "Tavern on the Green", "🏁", "main character finish."],
    ],
  },
  {
    id: "central-park-loop",
    name: "Central Park Full Loop",
    short: "6.03 mi · counterclockwise",
    blurb: "The NYRR home loop. Cat Hill, Harlem Hill, and every 9+1 race you've ever done.",
    official: 6.03 * MI,
    defaultGoal: 52 * 60,
    emoji: "🌳",
    path: [
      [40.7718, -73.9693], [40.7750, -73.9672], [40.7780, -73.9650], [40.7810, -73.9628],
      [40.7840, -73.9605], [40.7872, -73.9582], [40.7905, -73.9560], [40.7935, -73.9538],
      [40.7955, -73.9520], [40.7972, -73.9508], [40.7990, -73.9520], [40.8000, -73.9545],
      [40.7998, -73.9568], [40.7990, -73.9585], [40.7975, -73.9597], [40.7960, -73.9610],
      [40.7935, -73.9630], [40.7905, -73.9650], [40.7880, -73.9670], [40.7850, -73.9690],
      [40.7820, -73.9710], [40.7795, -73.9730], [40.7770, -73.9750], [40.7735, -73.9770],
      [40.7700, -73.9790], [40.7665, -73.9800], [40.7655, -73.9785], [40.7660, -73.9760],
      [40.7655, -73.9735], [40.7665, -73.9715], [40.7690, -73.9708], [40.7718, -73.9693],
    ],
    ele: [
      [0, 30], [0.35, 24], [0.6, 36], [1.1, 32], [1.6, 28], [2.0, 8], [2.35, 8], [2.7, 42],
      [3.0, 38], [3.8, 32], [4.5, 28], [5.0, 22], [5.4, 20], [5.8, 27], [6.03, 30],
    ],
    landmarks: [
      [0, "East 72nd St", "🚦", "the classic NYRR start chute."],
      [0.5, "Cat Hill", "🐈‍⬛", "short, steep, judgmental cat statue."],
      [1.1, "Engineers' Gate", "🚪", "the Reservoir crowd. look alive."],
      [2.1, "Harlem Meer", "🦆", "flat + fast. bank some time."],
      [2.55, "Harlem Hill", "⛰️", "THE hill. queue a banger at the base."],
      [4.5, "Strawberry Fields", "🍓", "imagine a negative split."],
      [5.0, "Tavern on the Green", "🍽️", "marathon finish ghosts."],
      [5.4, "Central Park South", "🏙️", "rolling home. drop the kick."],
    ],
  },
  {
    id: "brooklyn-half",
    name: "Brooklyn Half",
    short: "13.1 · Prospect Park → Coney",
    blurb: "Hills first, then Ocean Parkway's endless straight, then the boardwalk and the ocean.",
    official: 21097.5,
    defaultGoal: 2 * 3600,
    emoji: "🎢",
    path: [
      [40.6716, -73.9635], [40.6705, -73.9575], [40.6693, -73.9480], [40.6700, -73.9560],
      [40.6716, -73.9635], [40.6738, -73.9701], [40.6715, -73.9690], [40.6680, -73.9660],
      [40.6620, -73.9635], [40.6575, -73.9650], [40.6540, -73.9690], [40.6530, -73.9720],
      [40.6550, -73.9765], [40.6600, -73.9790], [40.6650, -73.9765], [40.6700, -73.9725],
      [40.6715, -73.9690], [40.6680, -73.9660], [40.6620, -73.9635], [40.6575, -73.9650],
      [40.6540, -73.9690], [40.6505, -73.9725], [40.6450, -73.9735], [40.6400, -73.9735],
      [40.6320, -73.9720], [40.6250, -73.9705], [40.6175, -73.9692], [40.6100, -73.9680],
      [40.6025, -73.9668], [40.5950, -73.9655], [40.5870, -73.9665], [40.5800, -73.9690],
      [40.5765, -73.9705], [40.5745, -73.9760], [40.5735, -73.9800], [40.5728, -73.9840],
    ],
    ele: [
      [0, 45], [1.0, 40], [2.0, 46], [2.6, 50], [3.3, 30], [3.9, 22], [4.4, 30], [5.0, 46],
      [5.6, 50], [6.2, 30], [6.9, 25], [7.5, 22], [9, 16], [10.5, 10], [12, 5], [12.6, 4],
      [13.11, 4],
    ],
    landmarks: [
      [0, "Brooklyn Museum", "🏛️", "corral energy. stay chill."],
      [2.6, "Grand Army Plaza", "🏟️", "into the park we go."],
      [4.6, "Prospect Park hill", "⛰️", "the big climb. save something."],
      [7.0, "Ocean Parkway", "🛣️", "6 miles of straight. lock in, zone out."],
      [11.0, "Avenue X-ish", "🧂", "smell the ocean yet? almost."],
      [12.6, "Coney Island Boardwalk", "🎡", "wonder wheel = finish line soon."],
      [13.1, "Maimonides Park finish", "🏁", "Nathan's is right there."],
    ],
  },
];

export const PRESET_LIST = PRESETS.map(({ id, name, short, blurb, emoji, defaultGoal, official }) => ({
  id,
  name,
  short,
  blurb,
  emoji,
  defaultGoal,
  official,
}));

export function loadPreset(id: string): Course {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown course ${id}`);
  const landmarks: Landmark[] = p.landmarks.map(([mi, name, emoji, vibe]) => ({
    d: Math.min(p.official, mi * MI),
    name,
    emoji,
    vibe,
  }));
  const course = buildCourse({
    id: p.id,
    name: p.name,
    source: "preset",
    raw: p.path.map(([lat, lon]) => ({ lat, lon })),
    officialDistance: p.official,
    landmarks,
    approximate: true,
  });
  for (const pt of course.points) pt.ele = sketchElevation(p.ele, pt.d / MI);
  return course;
}

function sketchElevation(anchors: [number, number][], mile: number) {
  if (mile <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [m1, e1] = anchors[i];
    if (mile <= m1) {
      const [m0, e0] = anchors[i - 1];
      // Cosine ease so the sketch reads as hills instead of zigzags.
      const f = (1 - Math.cos(((mile - m0) / (m1 - m0)) * Math.PI)) / 2;
      return e0 + (e1 - e0) * f;
    }
  }
  return anchors[anchors.length - 1][1];
}
