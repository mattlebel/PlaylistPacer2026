"use client";

import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type ExpressionSpecification, type StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { bounds, makePointLookup } from "@/lib/geo";
import { basemapStyle, type BasemapMeta } from "@/lib/basemapStyle";
import { FINISH_MILE, MILES, mileLabel, RACE, raceCourse } from "@/lib/race";
import { ChipStack } from "./ChipStack";

/** CARTO's Dark Matter: a muted, grayscale street map. */
const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Grayscale land and water, drawn from the bundled borough outlines when the street map can't load. */
const LAND = "#2b2d36";
const WATER = "#17181f";
const FALLBACK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": WATER } }],
};

/** Borough names for the fallback map (the street map has its own labels). Placed clear of the course. */
const BOROUGH_LABELS: [string, number, number][] = [
  ["Staten Island", 40.618, -74.098],
  ["Brooklyn", 40.645, -73.94],
  ["Queens", 40.762, -73.902],
  ["Manhattan", 40.748, -74.003],
  ["The Bronx", 40.836, -73.884],
];

async function fetchWithin(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * The map background, best first: the app's own static street map for the course area (public/basemap),
 * then CARTO's hosted Dark Matter, then plain grayscale borough outlines.
 */
async function loadStyle(): Promise<{ style: StyleSpecification | string; bounds?: BasemapMeta["bounds"]; minzoom?: number }> {
  try {
    const res = await fetchWithin("/basemap/basemap.json", 4000);
    if (res.ok) {
      const meta = (await res.json()) as BasemapMeta;
      return { style: basemapStyle(window.location.origin, meta), bounds: meta.bounds, minzoom: meta.minzoom };
    }
  } catch {
    /* not shipped with this build: try the hosted map */
  }
  try {
    if ((await fetchWithin(STYLE_URL, 4000)).ok) return { style: STYLE_URL };
  } catch {
    /* offline or blocked: the borough outlines still show the route */
  }
  return { style: FALLBACK };
}

/** Marker sizes in px. Full cards show the chip stack; compact dots are for zoomed-out views like a phone. */
const SIZES = {
  full: { w: 30, h: 46, gap: 9 },
  compact: { w: 20, h: 20, gap: 5 },
} as const;
type Mode = keyof typeof SIZES;
/** Below this many pixels between mile markers, full cards start to collide. */
const FULL_MIN_SPACING = 30;

type Offset = { dx: number; dy: number };

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** The start and finish markers wear a START/FINISH tag above them, which needs room too. */
const TAG_H = 14;
const tagged = (i: number) => MILES[i].n === 0 || MILES[i].n === FINISH_MILE;
const rectAt = (mode: Mode, cx: number, cy: number, pad = 0, tag = false): Rect => ({
  x0: cx - SIZES[mode].w / 2 - pad - (tag ? 8 : 0),
  y0: cy - SIZES[mode].h / 2 - pad - (tag ? TAG_H : 0),
  x1: cx + SIZES[mode].w / 2 + pad + (tag ? 8 : 0),
  y1: cy + SIZES[mode].h / 2 + pad,
});
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const DIRS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return { ux: Math.cos(a), uy: Math.sin(a) };
});

/**
 * Places each marker card beside its point on the course, choosing the side that covers the
 * least of the route and of other cards. Runs in screen space after every zoom.
 */
function placeCards(map: MLMap): { mode: Mode; offsets: Offset[] } {
  const course = raceCourse();
  const look = makePointLookup(course);
  const route = course.points.filter((_, i) => i % 2 === 0).map((p) => map.project([p.lon, p.lat]));
  const anchors = MILES.map((m) => map.project(look(m.d)));
  const { clientWidth: W, clientHeight: H } = map.getContainer();
  const spacing = anchors.slice(1).reduce((sum, a, i) => sum + Math.hypot(a.x - anchors[i].x, a.y - anchors[i].y), 0) / (anchors.length - 1);
  const mode: Mode = spacing >= FULL_MIN_SPACING ? "full" : "compact";
  const { w: CARD_W, h: CARD_H, gap: GAP } = SIZES[mode];

  const costOf = (i: number, o: Offset, placed: (Offset | null)[]) => {
    const a = anchors[i];
    const r = rectAt(mode, a.x + o.dx, a.y + o.dy, 3, tagged(i));
    let cost = 0;
    for (const p of route) if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) cost += 6;
    anchors.forEach((b, j) => {
      if (j !== i && b.x > r.x0 && b.x < r.x1 && b.y > r.y0 && b.y < r.y1) cost += 60;
      const po = placed[j];
      if (j !== i && po) cost += overlap(r, rectAt(mode, b.x + po.dx, b.y + po.dy, 2, tagged(j))) * 6;
    });
    if (r.x0 < 4 || r.y0 < 4 || r.x1 > W - 4 || r.y1 > H - 4) cost += 400;
    return cost;
  };
  // Two rings of spots around each point: close by, or a little further out when it's crowded.
  const candidates = [0, 1].flatMap((ring) =>
    DIRS.map(({ ux, uy }) => ({ dx: ux * (CARD_W / 2 + GAP + ring * 16), dy: uy * (CARD_H / 2 + GAP + ring * 16), extra: ring * 25 })),
  );

  const placed: (Offset | null)[] = MILES.map(() => null);
  const score = (i: number, c: (typeof candidates)[number]) => costOf(i, c, placed) + c.extra;
  const best = (i: number) => {
    const c = candidates.reduce((b, x) => (score(i, x) < score(i, b) ? x : b));
    return { dx: c.dx, dy: c.dy };
  };
  for (let i = 0; i < MILES.length; i++) placed[i] = best(i);
  // One more pass, now that every card has a neighbor to avoid.
  for (let i = 0; i < MILES.length; i++) placed[i] = best(i);
  return { mode, offsets: placed as Offset[] };
}

const PADDING = { top: 64, bottom: 48, left: 48, right: 48 };

/**
 * Drag helpers: pause over the map and it glides in toward you; push against an edge and it drifts
 * that way. Both run in one animation loop with eased speeds, so nothing jumps.
 */
const DWELL_MS = 320;
/** Zoom speed while you hold still, in zoom levels per second. */
const ZOOM_RATE = 1.1;
/** How far in a drag can zoom, past the whole-course view: enough to separate the miles, not lose them. */
const MAX_DRAG_ZOOM_IN = 2;
/** Moving more than this (px) counts as moving on, so the zoom eases off. */
const STILL_PX = 14;
const EDGE_PX = 56;
/** Fastest edge pan, in px per second, right at the edge. */
const EDGE_RATE = 520;
/** How quickly speeds catch up with where they're heading (per second); higher is snappier. */
const EASE = 7;
/** Markers re-arrange this long after the map stops moving. */
const RELAYOUT_MS = 160;

export interface CourseMapHandle {
  /** The song being dragged is at this point on screen (client coordinates). */
  dragAt(x: number, y: number): void;
  /** The drag finished, dropped or not: settle back to the whole course. */
  dragEnd(): void;
}

/* ---------- charge-up: a pulse runs along the course to a mile that just got a song ---------- */

type Stop = [number, string];
const CLEAR = "rgba(0,0,0,0)";
const SNAKE = 0.09; // length of the bright head and tail, as a share of the course

/** A line-gradient over the course: filled from the start to `head`, with a bright snake head at `head`. */
function chargeGradient(head: number, fill: number, glow: number) {
  const tail = Math.max(0, head - SNAKE);
  const raw: Stop[] = [
    [0, `rgba(255,224,138,${fill})`],
    [tail, `rgba(255,224,138,${fill})`],
    [head - SNAKE * 0.45, `rgba(255,224,138,${glow})`],
    [head, `rgba(255,255,255,${glow})`],
    [head + 0.004, CLEAR],
    [1, CLEAR],
  ];
  // MapLibre needs strictly increasing stops between 0 and 1.
  const stops: Stop[] = [];
  for (const [at, color] of raw) {
    const prev = stops.at(-1)?.[0] ?? -1;
    const x = Math.min(1, Math.max(at, prev + 1e-5));
    if (x > prev && x <= 1) stops.push([x, color]);
  }
  return ["interpolate", ["linear"], ["line-progress"], ...stops.flat()] as unknown as ExpressionSpecification;
}
const NO_CHARGE = ["interpolate", ["linear"], ["line-progress"], 0, CLEAR, 1, CLEAR] as unknown as ExpressionSpecification;

export interface MarkerState {
  count: number;
  /** Highlighted as the drop target while a song is being dragged. */
  hot?: boolean;
  selected?: boolean;
}

/** The NYC course with a chip-stack marker for every mile. Markers carry data-drop-mile for drag and drop. */
export function CourseMap({
  markers,
  perMile,
  dragging = false,
  onSelect,
  className = "",
  charge = null,
  ref,
}: {
  markers: MarkerState[];
  perMile: number;
  dragging?: boolean;
  onSelect?(n: number): void;
  className?: string;
  /** A song just landed on mile `n`: run the charge-up to it. `key` changes for each new song. */
  charge?: { n: number; key: number } | null;
  ref?: Ref<CourseMapHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [wraps, setWraps] = useState<HTMLElement[]>([]);
  const [layout, setLayout] = useState<{ mode: Mode; offsets: Offset[] }>({ mode: "full", offsets: [] });
  const [pulse, setPulse] = useState<{ n: number; key: number } | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const relayout = useCallback(() => {
    if (map.current) setLayout(placeCards(map.current));
  }, []);

  // While a song is dragged over the map: glide in toward where it pauses, drift at the edges.
  const drag = useRef({
    live: false,
    /** True while the loop itself is moving the map (so its zoom events don't re-arrange markers). */
    stepping: false,
    pointer: null as { x: number; y: number } | null,
    anchor: null as { x: number; y: number } | null,
    stillSince: 0,
    zoomVel: 0,
    panVel: { x: 0, y: 0 },
    last: 0,
    raf: 0,
    baseZoom: null as number | null,
    settle: 0 as ReturnType<typeof setTimeout> | 0,
    relayout: 0 as ReturnType<typeof setTimeout> | 0,
  });

  useImperativeHandle(ref, () => {
    const st = drag.current;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Re-arrange the marker cards once the map is at rest, not on every frame.
    const relayoutSoon = () => {
      if (st.relayout) clearTimeout(st.relayout);
      st.relayout = setTimeout(() => {
        st.relayout = 0;
        if (map.current) setLayout(placeCards(map.current));
      }, RELAYOUT_MS);
    };
    const tick = (t: number) => {
      st.raf = 0;
      const m = map.current;
      if (!m) return;
      const dt = st.last ? Math.min(0.05, (t - st.last) / 1000) : 1 / 60;
      st.last = t;
      const p = st.pointer;
      const r = m.getContainer().getBoundingClientRect();
      const base = st.baseZoom ?? m.getZoom();
      const z = m.getZoom();
      const maxZ = base + MAX_DRAG_ZOOM_IN;

      // Zoom: speeds up while you hold still, slows as it nears the limit, eases off when you move.
      const still = st.live && p && performance.now() - st.stillSince > DWELL_MS;
      const left = maxZ - z;
      const zoomTarget = still && !reduced() && left > 0.01 ? ZOOM_RATE * Math.min(1, 0.25 + left / 0.5) : 0;
      st.zoomVel += (zoomTarget - st.zoomVel) * Math.min(1, dt * EASE);
      if (st.zoomVel < 0.02 || left <= 0.01) st.zoomVel = 0;

      // Pan: only once zoomed in, faster the closer you are to the edge.
      let vx = 0;
      let vy = 0;
      if (st.live && p && z > base + 0.3) {
        const depth = (d: number) => Math.max(0, 1 - d / EDGE_PX) ** 2;
        vx = (depth(p.x - r.left) * -1 + depth(r.right - p.x)) * EDGE_RATE;
        vy = (depth(p.y - r.top) * -1 + depth(r.bottom - p.y)) * EDGE_RATE;
      }
      st.panVel.x += (vx - st.panVel.x) * Math.min(1, dt * EASE);
      st.panVel.y += (vy - st.panVel.y) * Math.min(1, dt * EASE);
      if (Math.abs(st.panVel.x) < 2) st.panVel.x = 0;
      if (Math.abs(st.panVel.y) < 2) st.panVel.y = 0;

      const moving = st.zoomVel > 0 || st.panVel.x || st.panVel.y;
      st.stepping = true;
      if (st.zoomVel > 0 && p) {
        const around = m.unproject([p.x - r.left, p.y - r.top]);
        m.easeTo({ zoom: Math.min(maxZ, z + st.zoomVel * dt), around, duration: 0 });
      }
      if (st.panVel.x || st.panVel.y) m.panBy([st.panVel.x * dt, st.panVel.y * dt], { duration: 0 });
      st.stepping = false;
      // Cards keep their places while you drag (no shuffling under the pointer); they re-arrange after.
      if (moving && !st.live) relayoutSoon();
      if (st.live || moving) st.raf = requestAnimationFrame(tick);
      else st.last = 0;
    };
    const run = () => {
      if (!st.raf) st.raf = requestAnimationFrame(tick);
    };
    return {
      dragAt(x, y) {
        const m = map.current;
        if (!m) return;
        if (st.settle) clearTimeout(st.settle);
        st.settle = 0;
        st.baseZoom ??= m.getZoom();
        const r = m.getContainer().getBoundingClientRect();
        const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        st.live = inside;
        st.pointer = inside ? { x, y } : null;
        if (!inside) st.anchor = null;
        else if (!st.anchor || Math.hypot(x - st.anchor.x, y - st.anchor.y) > STILL_PX) {
          st.anchor = { x, y };
          st.stillSince = performance.now();
        }
        run();
      },
      dragEnd() {
        st.live = false;
        st.pointer = null;
        st.anchor = null;
        const m = map.current;
        const zoomed = m && st.baseZoom !== null && m.getZoom() > st.baseZoom + 0.3;
        st.baseZoom = null;
        // Give the drop a moment to land, then glide back out to the whole course.
        if (m && zoomed)
          st.settle = setTimeout(() => {
            st.zoomVel = 0;
            st.panVel = { x: 0, y: 0 };
            m.fitBounds(bounds(raceCourse()), { padding: PADDING, duration: reduced() ? 0 : 1100, easing: (k) => 1 - (1 - k) ** 3 });
          }, 700);
      },
    };
  }, []);

  useEffect(() => {
    const st = drag.current;
    return () => {
      if (st.settle) clearTimeout(st.settle);
      if (st.relayout) clearTimeout(st.relayout);
      if (st.raf) cancelAnimationFrame(st.raf);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const course = raceCourse();
    // Served from /public (see scripts/copy-maplibre-worker.mjs).
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    loadStyle().then(({ style, bounds: area, minzoom }) => {
      if (disposed || !box.current) return;
      const m = new MLMap({
        container: box.current,
        style,
        bounds: bounds(course),
        // With the static map, stay around the area it covers. (The overview's tiles reach a bit past it,
        // and wide screens need the room.)
        maxBounds: area ? [area[0] - 0.12, area[1] - 0.06, area[2] + 0.12, area[3] + 0.06] : undefined,
        minZoom: minzoom,
        maxZoom: 16,
        fitBoundsOptions: { padding: PADDING },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.on("load", async () => {
        // Start the map credit folded into its (i) button, so it doesn't cover the start of the course.
        m.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        // The five boroughs, under everything. With the street map loaded, its own land and water cover
        // these; if its tiles don't arrive, the outlines still show where the course is.
        // (The static map has its own land and water, so it doesn't need them.)
        if (!area) {
          const land = (await import("@/lib/courses/nyc-boroughs.json")).default as GeoJSON.FeatureCollection;
          if (disposed) return;
          const above = m.getStyle().layers[1]?.id;
          m.addSource("land", { type: "geojson", data: land });
          m.addLayer({ id: "land", type: "fill", source: "land", paint: { "fill-color": LAND } }, above);
          m.addLayer({ id: "land-edge", type: "line", source: "land", paint: { "line-color": "#3a3d4a", "line-width": 0.8 } }, above);
        }
        if (style === FALLBACK) {
          const labels = BOROUGH_LABELS.map(([name, lat, lon]) => {
            const el = document.createElement("div");
            el.className = "pointer-events-none whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.18em] text-pink/35";
            el.textContent = name;
            new Marker({ element: el }).setLngLat([lon, lat]).addTo(m);
            return el;
          });
          // Hide a name that would be cut off by the map's edge or sit under the zoom buttons.
          const fit = () => {
            const box = m.getContainer().getBoundingClientRect();
            const ctrl = m.getContainer().querySelector(".maplibregl-ctrl-top-right")?.getBoundingClientRect();
            for (const el of labels) {
              el.style.visibility = "";
              const r = el.getBoundingClientRect();
              const inside = r.left >= box.left + 4 && r.right <= box.right - 4 && r.top >= box.top + 4 && r.bottom <= box.bottom - 4;
              const underCtrl = ctrl && r.right > ctrl.left && r.left < ctrl.right && r.bottom > ctrl.top && r.top < ctrl.bottom;
              el.style.visibility = inside && !underCtrl ? "" : "hidden";
            }
          };
          m.on("moveend", fit);
          m.on("resize", fit);
          requestAnimationFrame(fit);
        }
        m.addSource("course", {
          type: "geojson",
          lineMetrics: true, // lets the charge-up gradient run along the line
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: course.points.map((p) => [p.lon, p.lat]) } },
        });
        m.addLayer({
          id: "course-glow",
          type: "line",
          source: "course",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#F7D3D8", "line-width": 12, "line-opacity": 0.12, "line-blur": 4 },
        });
        m.addLayer({
          id: "course",
          type: "line",
          source: "course",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#F7D3D8", "line-width": 3 },
        });
        m.addLayer({
          id: "course-charge",
          type: "line",
          source: "course",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-width": 9, "line-blur": 2.5, "line-gradient": NO_CHARGE },
        });
        const look = makePointLookup(course);
        const els = MILES.map((mile) => {
          // A zero-size anchor: MapLibre positions it on the course, and the card hangs off it.
          const wrap = document.createElement("div");
          wrap.style.width = "0";
          wrap.style.height = "0";
          new Marker({ element: wrap, anchor: "center" }).setLngLat(look(mile.d)).addTo(m);
          return wrap;
        });
        setWraps(els);
        setLayout(placeCards(m));
      });
      // During a drag the loop above re-arranges the markers once things settle.
      m.on("zoomend", () => {
        if (!drag.current.stepping && !drag.current.live) setLayout(placeCards(m));
      });
      m.on("resize", () => setLayout(placeCards(m)));
      map.current = m;
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Charge-up: the snake runs from the start to the mile, the line fills behind it, then it fades and the marker flashes.
  useEffect(() => {
    const m = map.current;
    if (!charge || !m || !wraps.length || !m.getLayer("course-charge")) return;
    const target = Math.min(1, (MILES.find((x) => x.n === charge.n)?.d ?? 0) / RACE.distance);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = reduced ? 0 : 450 + 1150 * target;
    const fade = reduced ? 0 : 650;
    const t0 = performance.now();
    let raf = 0;
    let flashed = false;
    const frame = (t: number) => {
      const el = t - t0;
      if (el < run) {
        const k = 1 - Math.pow(1 - el / run, 3); // ease out
        m.setPaintProperty("course-charge", "line-gradient", chargeGradient(target * k, 0.7, 1));
      } else if (el < run + fade) {
        if (!flashed) {
          flashed = true;
          setPulse({ n: charge.n, key: charge.key });
        }
        const k = 1 - (el - run) / fade;
        m.setPaintProperty("course-charge", "line-gradient", chargeGradient(target, 0.7 * k, k));
      } else {
        if (!flashed) setPulse({ n: charge.n, key: charge.key });
        m.setPaintProperty("course-charge", "line-gradient", NO_CHARGE);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      m.setPaintProperty("course-charge", "line-gradient", NO_CHARGE);
    };
  }, [charge, wraps.length]);

  // Lift the highlighted marker above its neighbors (each marker is its own stacking context).
  useEffect(() => {
    wraps.forEach((w, i) => {
      const st = markers[i];
      w.style.zIndex = st?.hot ? "30" : st?.selected ? "20" : "";
    });
  }, [wraps, markers]);

  // The page can change size (e.g. fonts loading); keep cards placed for the current view.
  useEffect(() => {
    window.addEventListener("orientationchange", relayout);
    return () => window.removeEventListener("orientationchange", relayout);
  }, [relayout]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={box} className="h-full w-full" />
      {wraps.length === 0 && <div className="absolute inset-0 grid place-items-center text-pink/50">Loading the course…</div>}
      {wraps.map((wrap, i) =>
        createPortal(
          <MarkerCard
            n={MILES[i].n}
            title={MILES[i].title}
            landmark={!!MILES[i].landmark}
            mode={layout.mode}
            offset={layout.offsets[i] ?? { dx: 0, dy: -(SIZES.full.h / 2 + SIZES.full.gap) }}
            state={markers[i] ?? { count: 0 }}
            perMile={perMile}
            dragging={dragging}
            pulseKey={pulse?.n === MILES[i].n ? pulse.key : undefined}
            onSelect={() => onSelectRef.current?.(MILES[i].n)}
          />,
          wrap,
          `mile-${i}`,
        ),
      )}
    </div>
  );
}

/** Green flag at the start, red at the finish. */
export function Flag({ kind, size = 11 }: { kind: "start" | "finish"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="shrink-0">
      <path d="M2 1v10.5" stroke="#F7D3D8" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.6 1.4h7.2L8.2 4l1.6 2.6H2.6z" fill={kind === "start" ? "#3FD17A" : "#FF5A5F"} />
    </svg>
  );
}

function MarkerCard({
  n,
  title,
  landmark,
  mode,
  offset,
  state,
  perMile,
  dragging,
  pulseKey,
  onSelect,
}: {
  n: number;
  title: string;
  landmark: boolean;
  mode: Mode;
  offset: Offset;
  state: MarkerState;
  perMile: number;
  dragging: boolean;
  /** Changes when the charge-up reaches this marker, which restarts its flash. */
  pulseKey?: number;
  onSelect(): void;
}) {
  const full = state.count >= perMile;
  const { w, h } = SIZES[mode];
  const flag = n === 0 ? "start" : n === FINISH_MILE ? "finish" : null;
  const len = Math.hypot(offset.dx, offset.dy);
  const angle = (Math.atan2(offset.dy, offset.dx) * 180) / Math.PI;
  return (
    <>
      {/* Leader line from the course to the card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-px origin-left bg-pink/50"
        style={{ width: len, transform: `rotate(${angle}deg)` }}
      />
      <span aria-hidden className="pointer-events-none absolute -left-[4px] -top-[4px] h-2 w-2 rounded-full border-2 border-pink bg-ink" />
      <button
        key={pulseKey ?? "still"}
        type="button"
        data-drop-mile={n}
        data-charged={pulseKey ? "" : undefined}
        data-full={full || undefined}
        onClick={onSelect}
        aria-label={`${mileLabel(n)}, ${title}: ${state.count} of ${perMile} songs`}
        className={`absolute flex items-center shadow-[0_6px_14px_rgb(8_10_40/0.45)] transition-[transform,box-shadow,opacity] duration-150 ${
          mode === "full" ? "flex-col gap-[3px] rounded-lg px-1 pb-1.5 pt-1" : "justify-center rounded-full"
        } ${
          state.hot
            ? "z-20 scale-[1.45] bg-ink ring-2 ring-butter"
            : state.selected
              ? "z-10 scale-125 bg-ink ring-2 ring-chalk"
              : full
                ? "bg-ink/90 ring-1 ring-pink/60"
                : "bg-ink/85 ring-1 ring-pink/25 hover:scale-110"
        } ${dragging && full && !state.hot ? "opacity-40" : ""} ${dragging && !full && !state.hot ? "ring-pink/70" : ""} ${
          pulseKey ? "animate-[charge_0.9s_ease-out]" : ""
        }`}
        style={{ width: w, height: h, left: offset.dx - w / 2, top: offset.dy - h / 2 }}
      >
        {flag && (
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full font-mono font-bold uppercase text-ink shadow-[0_2px_6px_rgb(8_10_40/0.5)] ${
              flag === "start" ? "bg-[#3FD17A]" : "bg-[#FF5A5F]"
            } ${mode === "full" ? "mb-[3px] px-1.5 py-[1px] text-[7.5px] tracking-wider" : "mb-[2px] px-1 text-[6px] tracking-normal"}`}
          >
            {flag}
          </span>
        )}
        {mode === "full" ? (
          <>
            {flag ? <Flag kind={flag} /> : <span className={`font-mono text-[9px] font-semibold leading-none ${full ? "text-chalk" : "text-pink"}`}>{n}</span>}
            <ChipStack count={state.count} max={perMile} size="sm" />
          </>
        ) : (
          <>
            {/* A ring that fills a quarter per song: the chip stack, squeezed into a dot. */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(#F7D3D8 0 ${(state.count / perMile) * 360}deg, rgb(247 211 216 / 0.18) 0)`,
                mask: "radial-gradient(circle, transparent 6.5px, #000 7px)",
              }}
            />
            {flag ? (
              <span className="relative">
                <Flag kind={flag} size={10} />
              </span>
            ) : (
              <span className={`relative font-mono text-[8px] font-semibold leading-none ${full ? "text-chalk" : "text-pink"}`}>{n}</span>
            )}
          </>
        )}
        {landmark && !flag && <span aria-hidden className="absolute -right-1.5 -top-1.5 text-[10px] leading-none text-butter">★</span>}
      </button>
    </>
  );
}
