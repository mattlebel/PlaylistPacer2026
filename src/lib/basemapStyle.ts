import type { StyleSpecification } from "maplibre-gl";

/** What scripts/fetch-basemap.mjs writes next to the tiles. */
export interface BasemapMeta {
  bounds: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  attribution: string;
}

/** Muted grayscale, so the pink course and the mile markers carry the color. */
const C = {
  land: "#25272f",
  water: "#15161c",
  park: "#2b2e33",
  airport: "#2d2f37",
  minor: "#30323b",
  street: "#383a45",
  major: "#424553",
  highway: "#4c4f5f",
  rail: "#353743",
};

const width = (base: number, top: number) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 10, base, 16, top] as unknown as number;

const road = (id: string, classes: string[], color: string, w: [number, number], extra: Record<string, unknown> = {}) => ({
  id,
  type: "line" as const,
  source: "basemap",
  "source-layer": "transportation",
  filter: ["all", ["in", ["get", "class"], ["literal", classes]], ["!=", ["get", "brunnel"], "tunnel"]],
  layout: { "line-cap": "round" as const, "line-join": "round" as const },
  paint: { "line-color": color, "line-width": width(...w), ...extra },
});

/**
 * The static street map for the course area, served from /basemap (see scripts/fetch-basemap.mjs).
 * No labels, so no fonts or icons to load: just land, water, parks and streets in grays.
 */
export function basemapStyle(origin: string, meta: BasemapMeta): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "vector",
        tiles: [`${origin}/basemap/tiles/{z}/{x}/{y}.pbf`],
        minzoom: meta.minzoom,
        maxzoom: meta.maxzoom,
        bounds: meta.bounds,
        attribution: meta.attribution,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": C.land } },
      { id: "water", type: "fill", source: "basemap", "source-layer": "water", paint: { "fill-color": C.water } },
      {
        id: "waterway",
        type: "line",
        source: "basemap",
        "source-layer": "waterway",
        paint: { "line-color": C.water, "line-width": width(0.5, 3) },
      },
      {
        id: "parks",
        type: "fill",
        source: "basemap",
        "source-layer": "park",
        paint: { "fill-color": C.park },
      },
      {
        id: "green",
        type: "fill",
        source: "basemap",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "wood", "farmland", "wetland"]]],
        paint: { "fill-color": C.park, "fill-opacity": 0.7 },
      },
      {
        id: "airport",
        type: "fill",
        source: "basemap",
        "source-layer": "aeroway",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": C.airport },
      },
      {
        id: "rail",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["all", ["==", ["get", "class"], "rail"], ["!=", ["get", "brunnel"], "tunnel"]],
        paint: { "line-color": C.rail, "line-width": 1, "line-dasharray": [3, 3] },
      },
      road("roads-minor", ["minor", "service"], C.minor, [0.2, 2.5], { "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] }),
      road("roads-street", ["tertiary", "secondary"], C.street, [0.4, 4]),
      road("roads-major", ["primary", "trunk"], C.major, [0.6, 5]),
      road("roads-highway", ["motorway"], C.highway, [0.8, 6]),
    ],
  } as StyleSpecification;
}
