"use client";

import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bounds, makePointLookup } from "@/lib/geo";
import { MILES, mileLabel, raceCourse } from "@/lib/race";
import { ChipStack } from "./ChipStack";

const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const FALLBACK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#16288C" } }],
};

async function loadStyle(): Promise<StyleSpecification | string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(STYLE_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) return STYLE_URL;
  } catch {
    /* offline or blocked: a plain background still shows the route */
  }
  return FALLBACK;
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
}: {
  markers: MarkerState[];
  perMile: number;
  dragging?: boolean;
  onSelect?(n: number): void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [wraps, setWraps] = useState<HTMLElement[]>([]);
  const [layout, setLayout] = useState<{ mode: Mode; offsets: Offset[] }>({ mode: "full", offsets: [] });
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const relayout = useCallback(() => {
    if (map.current) setLayout(placeCards(map.current));
  }, []);

  useEffect(() => {
    let disposed = false;
    const course = raceCourse();
    // Served from /public (see scripts/copy-maplibre-worker.mjs).
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    loadStyle().then((style) => {
      if (disposed || !box.current) return;
      const m = new MLMap({
        container: box.current,
        style,
        bounds: bounds(course),
        fitBoundsOptions: { padding: { top: 64, bottom: 48, left: 48, right: 48 } },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        m.addSource("course", {
          type: "geojson",
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
        type="button"
        data-drop-mile={n}
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
        } ${dragging && full && !state.hot ? "opacity-40" : ""} ${dragging && !full && !state.hot ? "ring-pink/70" : ""}`}
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
