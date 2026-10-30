"use client";

import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type ExpressionSpecification, type StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { bounds, makePointLookup } from "@/lib/geo";
import { basemapStyle, type BasemapMeta } from "@/lib/basemapStyle";
import { MILES, mileLabel, RACE, raceCourse } from "@/lib/race";
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
const rectAt = (mode: Mode, cx: number, cy: number, pad = 0): Rect => ({
  x0: cx - SIZES[mode].w / 2 - pad,
  y0: cy - SIZES[mode].h / 2 - pad,
  x1: cx + SIZES[mode].w / 2 + pad,
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
    const r = rectAt(mode, a.x + o.dx, a.y + o.dy, 3);
    let cost = 0;
    for (const p of route) if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) cost += 6;
    anchors.forEach((b, j) => {
      if (j !== i && b.x > r.x0 && b.x < r.x1 && b.y > r.y0 && b.y < r.y1) cost += 60;
      const po = placed[j];
      if (j !== i && po) cost += overlap(r, rectAt(mode, b.x + po.dx, b.y + po.dy, 2)) * 6;
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

/** Drag helpers: pause over the map and it zooms in toward you; push against an edge and it pans. */
const DWELL_MS = 380;
const NEXT_STEP_MS = 1100;
const ZOOM_STEP = 1;
/** How far in a drag can zoom, past the whole-course view: enough to separate the miles, not lose them. */
const MAX_DRAG_ZOOM_IN = 2;
const EDGE_PX = 44;
const EDGE_SPEED = 9;

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

  // While a song is dragged over the map: zoom toward where it pauses, pan at the edges.
  const drag = useRef({
    anchor: null as { x: number; y: number } | null,
    timer: 0 as ReturnType<typeof setTimeout> | 0,
    raf: 0,
    edge: { dx: 0, dy: 0 },
    baseZoom: null as number | null,
    settle: 0 as ReturnType<typeof setTimeout> | 0,
  });

  useImperativeHandle(ref, () => {
    const st = drag.current;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stopEdge = () => {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    const panLoop = () => {
      const m = map.current;
      if (!m || (!st.edge.dx && !st.edge.dy)) return stopEdge();
      m.panBy([st.edge.dx * EDGE_SPEED, st.edge.dy * EDGE_SPEED], { duration: 0 });
      st.raf = requestAnimationFrame(panLoop);
    };
    const zoomAt = (x: number, y: number) => {
      const m = map.current;
      if (!m) return;
      const z = m.getZoom();
      const target = Math.min(z + ZOOM_STEP, (st.baseZoom ?? z) + MAX_DRAG_ZOOM_IN);
      if (target - z < 0.2) return;
      const r = m.getContainer().getBoundingClientRect();
      m.easeTo({ zoom: target, around: m.unproject([x - r.left, y - r.top]), duration: reduced() ? 0 : 450 });
      // Still hovering here a bit later? Zoom in another step.
      st.timer = setTimeout(() => zoomAt(x, y), NEXT_STEP_MS);
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
        if (!inside) {
          if (st.timer) clearTimeout(st.timer);
          st.anchor = null;
          st.edge = { dx: 0, dy: 0 };
          return stopEdge();
        }
        // Only pan once zoomed in; at the overview the whole course is already on screen.
        const zoomedIn = m.getZoom() > st.baseZoom + 0.3;
        st.edge = zoomedIn
          ? { dx: x < r.left + EDGE_PX ? -1 : x > r.right - EDGE_PX ? 1 : 0, dy: y < r.top + EDGE_PX ? -1 : y > r.bottom - EDGE_PX ? 1 : 0 }
          : { dx: 0, dy: 0 };
        if ((st.edge.dx || st.edge.dy) && !st.raf) st.raf = requestAnimationFrame(panLoop);
        if (!st.anchor || Math.hypot(x - st.anchor.x, y - st.anchor.y) > 14) {
          st.anchor = { x, y };
          if (st.timer) clearTimeout(st.timer);
          st.timer = setTimeout(() => zoomAt(x, y), DWELL_MS);
        }
      },
      dragEnd() {
        if (st.timer) clearTimeout(st.timer);
        stopEdge();
        st.anchor = null;
        st.edge = { dx: 0, dy: 0 };
        const m = map.current;
        const zoomed = m && st.baseZoom !== null && m.getZoom() > st.baseZoom + 0.3;
        st.baseZoom = null;
        // Give the drop a moment to land, then show the whole course again.
        if (m && zoomed) st.settle = setTimeout(() => m.fitBounds(bounds(raceCourse()), { padding: PADDING, duration: reduced() ? 0 : 800 }), 900);
      },
    };
  }, []);

  useEffect(() => {
    const st = drag.current;
    return () => {
      if (st.timer) clearTimeout(st.timer);
      if (st.settle) clearTimeout(st.settle);
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
      m.on("zoomend", () => setLayout(placeCards(m)));
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
        {mode === "full" ? (
          <>
            <span className={`font-mono text-[9px] font-semibold leading-none ${full ? "text-chalk" : "text-pink"}`}>{n === 0 ? "GO" : n}</span>
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
            <span className={`relative font-mono text-[8px] font-semibold leading-none ${full ? "text-chalk" : "text-pink"}`}>{n === 0 ? "GO" : n}</span>
          </>
        )}
        {landmark && <span aria-hidden className="absolute -right-1.5 -top-1.5 text-[10px] leading-none text-butter">★</span>}
      </button>
    </>
  );
}
