import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { basemapStyle } from "@/lib/basemapStyle";

const meta = { bounds: [-74.16, 40.54, -73.8, 40.89] as [number, number, number, number], minzoom: 9, maxzoom: 14, attribution: "© OpenFreeMap" };

describe("static basemap style", () => {
  it("is a valid MapLibre style pointing at the app's own tiles", () => {
    const style = basemapStyle("https://example.test", meta);
    expect(validateStyleMin(style)).toEqual([]);
    expect(style.sources.basemap).toMatchObject({ type: "vector", tiles: ["https://example.test/basemap/tiles/{z}/{x}/{y}.pbf"], maxzoom: 14 });
  });

  it("needs no fonts or icons, so nothing loads from elsewhere", () => {
    const style = basemapStyle("https://example.test", meta);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(style.layers.some((l) => l.type === "symbol")).toBe(false);
    expect(JSON.stringify(style)).not.toMatch(/https?:\/\/(?!example\.test)/);
  });
});
