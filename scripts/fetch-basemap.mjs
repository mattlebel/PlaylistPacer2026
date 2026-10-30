#!/usr/bin/env node
/**
 * Downloads the street map for the NYC Marathon area once, so the app can serve it as static files
 * (public/basemap) instead of loading tiles from a map service on every visit.
 *
 * Source: OpenFreeMap (https://openfreemap.org), OpenStreetMap data in the OpenMapTiles schema,
 * free to use. Each tile is trimmed to what a muted background needs (water, parks, streets,
 * airports): no buildings, labels or points of interest, which keeps the whole set small.
 *
 *   node scripts/fetch-basemap.mjs            # writes public/basemap/
 *   BASEMAP_OUT=dir node scripts/fetch-basemap.mjs
 *
 * Run by .github/workflows/basemap.yml, which commits the result.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { VectorTile } from "@mapbox/vector-tile";
import { fromVectorTileJs } from "@maplibre/vt-pbf";
import { PbfReader } from "pbf";

const TILEJSON = process.env.BASEMAP_TILEJSON ?? "https://tiles.openfreemap.org/planet";
const OUT = process.env.BASEMAP_OUT ?? "public/basemap";

/** West, south, east, north: the course with room around it. The app keeps panning inside this. */
export const BBOX = [-74.16, 40.54, -73.8, 40.89];
export const MIN_ZOOM = 9;
export const MAX_ZOOM = 14; // OpenFreeMap's most detailed level; the map zooms in further on these

/** Layers and properties the muted style uses. Everything else is dropped. */
const KEEP = {
  water: ["class"],
  waterway: ["class"],
  landcover: ["class", "subclass"],
  park: ["class"],
  aeroway: ["class"],
  transportation: ["class", "subclass", "brunnel"],
};
const SKIP_ROADS = new Set(["path", "track", "ferry", "bridge", "pier"]);

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export function tilesFor(bbox = BBOX, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM) {
  const [w, s, e, n] = bbox;
  const out = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    for (let x = lon2x(w, z); x <= lon2x(e, z); x++) {
      for (let y = lat2y(n, z); y <= lat2y(s, z); y++) out.push({ z, x, y });
    }
  }
  return out;
}

/** Keeps only the layers, features and properties the style draws, and re-encodes the tile. */
export function trimTile(buf) {
  const bytes = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  const tile = new VectorTile(new PbfReader(bytes));
  const layers = {};
  for (const [name, props] of Object.entries(KEEP)) {
    const layer = tile.layers[name];
    if (!layer) continue;
    const features = [];
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (name === "transportation" && SKIP_ROADS.has(f.properties.class)) continue;
      const properties = {};
      for (const p of props) if (f.properties[p] !== undefined) properties[p] = f.properties[p];
      features.push({ type: f.type, properties, loadGeometry: () => f.loadGeometry() });
    }
    if (!features.length) continue;
    layers[name] = { name, version: 2, extent: layer.extent, length: features.length, feature: (i) => features[i] };
  }
  return Buffer.from(fromVectorTileJs({ layers }));
}

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "playlist-pacer basemap fetch (one-time, NYC area)" } });
      if (res.status === 204 || res.status === 404) return null; // no data here (open water)
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function main() {
  const meta = JSON.parse((await get(TILEJSON)).toString("utf8"));
  const template = meta.tiles[0];
  const list = tilesFor();
  console.log(`Fetching ${list.length} tiles (z${MIN_ZOOM}–${MAX_ZOOM}) from ${template}`);

  await rm(join(OUT, "tiles"), { recursive: true, force: true });
  let done = 0;
  let bytes = 0;
  const queue = [...list];
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const raw = await get(template.replace("{z}", t.z).replace("{x}", t.x).replace("{y}", t.y));
      const out = raw ? trimTile(raw) : Buffer.from(fromVectorTileJs({ layers: {} }));
      const dir = join(OUT, "tiles", String(t.z), String(t.x));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${t.y}.pbf`), out);
      bytes += out.length;
      if (++done % 50 === 0) console.log(`  ${done}/${list.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  await writeFile(
    join(OUT, "basemap.json"),
    JSON.stringify(
      {
        bounds: BBOX,
        minzoom: MIN_ZOOM,
        maxzoom: MAX_ZOOM,
        tiles: list.length,
        bytes,
        source: TILEJSON,
        version: template,
        fetchedAt: new Date().toISOString(),
        attribution: "© OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Done: ${list.length} tiles, ${(bytes / 1e6).toFixed(1)} MB in ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
