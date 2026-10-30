import { VectorTile } from "@mapbox/vector-tile";
import { fromVectorTileJs } from "@maplibre/vt-pbf";
import { PbfReader } from "pbf";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { BBOX, MAX_ZOOM, MIN_ZOOM, tilesFor, trimTile } from "../../scripts/fetch-basemap.mjs";

type Props = Record<string, string | number>;
const line = { x: 0, y: 0 };
const layer = (name: string, feats: { type: number; properties: Props }[]) => ({
  name,
  version: 2,
  extent: 4096,
  length: feats.length,
  feature: (i: number) => ({ ...feats[i], loadGeometry: () => [[line, { x: 100, y: 100 }, { x: 100, y: 0 }, line]] }),
});

/** A tile shaped like OpenMapTiles: what the map service sends. */
const sample = () =>
  Buffer.from(
    fromVectorTileJs({
      layers: {
        water: layer("water", [{ type: 3, properties: { class: "river", name: "East River" } }]),
        transportation: layer("transportation", [
          { type: 2, properties: { class: "primary", brunnel: "bridge", name: "Queensboro Bridge", oneway: 1 } },
          { type: 2, properties: { class: "path", subclass: "footway" } },
        ]),
        building: layer("building", [{ type: 3, properties: { render_height: 30 } }]),
        poi: layer("poi", [{ type: 1, properties: { name: "Cafe" } }]),
      },
    } as never),
  );

const decode = (buf: Buffer) => new VectorTile(new PbfReader(buf));

describe("static basemap download", () => {
  it("keeps water, parks and streets, and drops buildings, labels and footpaths", () => {
    const raw = sample();
    const out = trimTile(raw);
    const t = decode(out);
    expect(Object.keys(t.layers).sort()).toEqual(["transportation", "water"]);
    expect(t.layers.water.feature(0).properties).toEqual({ class: "river" });
    expect(t.layers.transportation.length).toBe(1);
    expect(t.layers.transportation.feature(0).properties).toEqual({ class: "primary", brunnel: "bridge" });
    expect(t.layers.transportation.feature(0).loadGeometry()[0]).toHaveLength(4);
    expect(out.length).toBeLessThan(raw.length);
  });

  it("reads gzipped tiles too", () => {
    expect(Object.keys(decode(trimTile(gzipSync(sample()))).layers)).toContain("water");
  });

  it("covers the course area from the overview down to street level", () => {
    const tiles = tilesFor();
    expect(MIN_ZOOM).toBe(9);
    expect(MAX_ZOOM).toBe(14);
    expect(new Set(tiles.map((t: { z: number }) => t.z)).size).toBe(6);
    // The course fits inside the downloaded area, with room around it.
    const [w, s, e, n] = BBOX;
    expect(w).toBeLessThan(-74.07);
    expect(e).toBeGreaterThan(-73.92);
    expect(s).toBeLessThan(40.6);
    expect(n).toBeGreaterThan(40.82);
    expect(tiles.length).toBeGreaterThan(300);
    expect(tiles.length).toBeLessThan(800);
  });
});
