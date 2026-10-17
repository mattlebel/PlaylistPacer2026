"use client";

import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { bounds, makePointLookup } from "@/lib/geo";
import { fmtMile, MOMENTS, raceCourse } from "@/lib/race";

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

export type PinState = "open" | "claimed" | "runner";

const PIN: Record<PinState, string> = {
  open: "bg-ground text-pink ring-2 ring-pink",
  claimed: "bg-pink text-ink",
  runner: "bg-chalk text-ink",
};

/** NYC course with one numbered pin per moment. */
export function RaceMap({
  states,
  selected,
  onSelect,
  className = "",
}: {
  states: Record<string, PinState>;
  selected?: string | null;
  onSelect?(id: string): void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const pins = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    const course = raceCourse();
    const pinEls = pins.current;
    // Served from /public (see scripts/copy-maplibre-worker.mjs).
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    loadStyle().then((style) => {
      if (disposed || !box.current) return;
      const m = new MLMap({
        container: box.current,
        style,
        bounds: bounds(course),
        fitBoundsOptions: { padding: { top: 40, bottom: 56, left: 40, right: 40 } },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
      });
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
        for (const mo of MOMENTS) {
          // MapLibre positions the wrapper with its own classes; we only restyle the button inside.
          const wrap = document.createElement("div");
          const el = document.createElement("button");
          el.type = "button";
          el.setAttribute("aria-label", `${mo.label}, mile ${fmtMile(mo.d)}`);
          el.dataset.moment = mo.id;
          el.addEventListener("click", () => onSelectRef.current?.(mo.id));
          wrap.appendChild(el);
          pinEls.set(mo.id, el);
          new Marker({ element: wrap }).setLngLat(look(mo.d)).addTo(m);
        }
        setReady(true);
      });
      map.current = m;
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      pinEls.clear();
    };
  }, []);

  // Restyle pins whenever claims or the selection change.
  useEffect(() => {
    if (!ready) return;
    MOMENTS.forEach((mo, i) => {
      const el = pins.current.get(mo.id);
      if (!el) return;
      const st = states[mo.id] ?? "open";
      const sel = selected === mo.id;
      el.className = `grid place-items-center rounded-full font-mono text-[10px] shadow-md transition ${PIN[st]} ${
        sel ? "h-9 w-9 outline-3 outline-offset-2 outline-chalk" : "h-6 w-6 hover:scale-110"
      } ${onSelectRef.current ? "cursor-pointer" : "cursor-default"}`;
      el.textContent = String(i + 1);
    });
  }, [states, selected, ready]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={box} className="h-full w-full" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-pink/50">Loading the course…</div>}
    </div>
  );
}
