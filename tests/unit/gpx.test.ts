// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseGpx } from "@/lib/gpx";

const TRACK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Metadata name</name></metadata>
  <trk><name>Brooklyn Half 2026</name><trkseg>
    <trkpt lat="40.6716" lon="-73.9635"><ele>45.2</ele><time>2026-05-16T11:00:00Z</time></trkpt>
    <trkpt lat="40.6720" lon="-73.9640"><ele>46.0</ele><time>2026-05-16T11:00:10Z</time></trkpt>
    <trkpt lat="40.6725" lon="-73.9645"><ele>47.1</ele><time>2026-05-16T11:00:21Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

describe("parseGpx", () => {
  it("reads track points with elevation and relative times", () => {
    const { name, points } = parseGpx(TRACK);
    expect(name).toBe("Brooklyn Half 2026");
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ lat: 40.6716, lon: -73.9635, ele: 45.2, t: 0 });
    expect(points[2].t).toBe(21);
  });

  it("falls back to route points and metadata name", () => {
    const gpx = `<gpx><metadata><name>Planned route</name></metadata><rte>
      <rtept lat="40.0" lon="-74.0"/><rtept lat="40.01" lon="-74.0"/></rte></gpx>`;
    const { name, points } = parseGpx(gpx);
    expect(name).toBe("Planned route");
    expect(points).toHaveLength(2);
    expect(points[0].ele).toBeUndefined();
    expect(points[0].t).toBeUndefined();
  });

  it("names unnamed courses", () => {
    expect(parseGpx('<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2"/></trkseg></trk></gpx>').name).toBe(
      "Mystery Course",
    );
  });

  it("rejects broken or empty files", () => {
    expect(() => parseGpx("<gpx><trk>")).toThrow(/isn't valid GPX/);
    expect(() => parseGpx("<gpx></gpx>")).toThrow(/No track points/);
  });
});
