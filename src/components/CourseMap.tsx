"use client";

import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { fmtDist, toUnits } from "@/lib/format";
import { bounds, makePointLookup, sliceCoords } from "@/lib/geo";
import type { Plan } from "@/lib/usePlan";

const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const FALLBACK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#121118" } }],
};

async function loadStyle(): Promise<StyleSpecification | string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(STYLE_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) return STYLE_URL;
  } catch {
    /* offline / blocked: plain dark canvas still shows the route */
  }
  return FALLBACK;
}

function markerEl(html: string, className: string) {
  const el = document.createElement("div");
  el.className = className;
  el.innerHTML = html;
  return el;
}

export function CourseMap({
  plan,
  selectedKey,
  onSelect,
  runnerD,
  follow = false,
  controls = true,
  className = "",
}: {
  plan: Plan;
  selectedKey: string | null;
  onSelect(key: string | null): void;
  runnerD?: number | null;
  follow?: boolean;
  controls?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const markers = useRef<Marker[]>([]);
  const runner = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    // Served from /public (see scripts/copy-maplibre-worker.mjs).
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    loadStyle().then((style) => {
      if (disposed || !box.current) return;
      const m = new MLMap({
        container: box.current,
        style,
        bounds: bounds(plan.course),
        fitBoundsOptions: { padding: 40 },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      if (controls) m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        m.addSource("course", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addSource("segments", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({
          id: "course-glow",
          type: "line",
          source: "course",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#fff3d6", "line-width": 16, "line-opacity": 0.08, "line-blur": 6 },
        });
        m.addLayer({
          id: "course-base",
          type: "line",
          source: "course",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#fff3d6", "line-width": 2, "line-opacity": 0.35, "line-dasharray": [2, 2] },
        });
        m.addLayer({
          id: "seg-casing",
          type: "line",
          source: "segments",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#000", "line-width": ["case", ["get", "selected"], 15, 10] },
        });
        m.addLayer({
          id: "seg",
          type: "line",
          source: "segments",
          layout: { "line-cap": "butt", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["case", ["get", "selected"], 10, 6],
            "line-opacity": ["case", ["get", "dim"], 0.35, 1],
          },
        });
        m.on("click", "seg", (e) => onSelectRef.current((e.features?.[0]?.properties?.key as string) ?? null));
        m.on("mouseenter", "seg", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "seg", () => (m.getCanvas().style.cursor = ""));
        setReady(true);
      });
      map.current = m;
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Course geometry + markers.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const c = plan.course;
    (m.getSource("course") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: c.points.map((p) => [p.lon, p.lat]) },
    });
    m.fitBounds(bounds(c), { padding: 48, duration: 600 });

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const look = makePointLookup(c);
    const add = (d: number, el: HTMLElement) => markers.current.push(new Marker({ element: el }).setLngLat(look(d)).addTo(m));

    const unit = plan.settings.units === "mi" ? 1609.344 : 1000;
    const total = toUnits(c.distance, plan.settings.units);
    const step = total > 30 ? 5 : total > 14 ? 2 : 1;
    for (let k = step; k * unit < c.distance - unit * 0.3; k += step) {
      add(
        k * unit,
        markerEl(
          `${k}`,
          "grid h-5 min-w-5 place-items-center rounded-full border-2 border-black bg-paper px-1 font-mono text-[10px] font-bold text-ink",
        ),
      );
    }
    for (const l of c.landmarks) {
      const el = markerEl(
        `<span class="text-lg leading-none">${l.emoji}</span>`,
        "grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-ink-2 shadow-[2px_2px_0_#000] cursor-help",
      );
      el.title = `${l.name} · ${fmtDist(l.d, plan.settings.units, 1)} ${plan.settings.units}`;
      add(l.d, el);
    }
    add(0, markerEl("START", "rounded-full border-2 border-black bg-acid px-2 py-0.5 font-display text-[10px] font-black text-ink shadow-[2px_2px_0_#000]"));
    add(c.distance, markerEl("🏁 FINISH", "rounded-full border-2 border-black bg-hot px-2 py-0.5 font-display text-[10px] font-black text-ink shadow-[2px_2px_0_#000]"));
  }, [plan.course, plan.settings.units, ready]);

  // Song segments.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const feats = plan.segments
      .filter((s) => s.phase === "race" && s.endD > s.startD)
      .map((s) => ({
        type: "Feature" as const,
        properties: {
          key: s.track.key,
          color: s.color,
          selected: s.track.key === selectedKey,
          dim: !!selectedKey && s.track.key !== selectedKey,
        },
        geometry: { type: "LineString" as const, coordinates: sliceCoords(plan.course, s.startD, s.endD) },
      }));
    (m.getSource("segments") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [plan.segments, plan.course, selectedKey, ready]);

  // Runner dot (preview mode).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (runnerD == null) {
      runner.current?.remove();
      runner.current = null;
      return;
    }
    const pos = makePointLookup(plan.course)(runnerD);
    if (!runner.current) {
      const el = markerEl(
        `<span class="absolute inset-0 animate-ping rounded-full bg-acid/70"></span><span class="relative block h-5 w-5 rounded-full border-[3px] border-black bg-acid"></span>`,
        "relative h-5 w-5",
      );
      runner.current = new Marker({ element: el }).setLngLat(pos).addTo(m);
    } else runner.current.setLngLat(pos);
    if (follow) m.jumpTo({ center: pos, zoom: Math.max(m.getZoom(), 14) });
  }, [runnerD, follow, plan.course, ready]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <div ref={box} className="h-full w-full" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-paper/40">warming up the map…</div>}
    </div>
  );
}
