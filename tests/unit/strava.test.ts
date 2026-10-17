import { describe, expect, it } from "vitest";
import { buildImportPayload, parseStravaUrl, StravaError, streamsByType } from "@/lib/server/strava";

describe("parseStravaUrl", () => {
  it("reads activity and route links", () => {
    expect(parseStravaUrl("https://www.strava.com/activities/12345678901")).toEqual({ kind: "activity", id: "12345678901" });
    expect(parseStravaUrl("https://www.strava.com/activities/123456789?share_sig=abc")).toEqual({ kind: "activity", id: "123456789" });
    expect(parseStravaUrl("strava.com/routes/3141592653589793238")).toEqual({ kind: "route", id: "3141592653589793238" });
  });
  it("accepts a bare activity id and keeps big route ids as strings", () => {
    expect(parseStravaUrl(" 9876543210 ")).toEqual({ kind: "activity", id: "9876543210" });
    expect(typeof parseStravaUrl("routes/3141592653589793238")!.id).toBe("string");
  });
  it("rejects anything else", () => {
    expect(parseStravaUrl("https://www.strava.com/athletes/42")).toBeNull();
    expect(parseStravaUrl("hello")).toBeNull();
    expect(parseStravaUrl("123")).toBeNull();
  });
});

describe("streamsByType", () => {
  it("normalizes keyed activity streams and route stream arrays", () => {
    expect(streamsByType({ latlng: { data: [[1, 2]] }, time: { data: [0] } })).toEqual({ latlng: [[1, 2]], time: [0] });
    expect(streamsByType([{ type: "latlng", data: [[1, 2]] }, { type: "altitude", data: [5] }])).toEqual({ latlng: [[1, 2]], altitude: [5] });
  });
});

describe("buildImportPayload", () => {
  const streams = {
    latlng: { data: [[40.6, -74.06], [40.61, -74.05]] },
    altitude: { data: [20, 60] },
    time: { data: [0, 300] },
  };

  it("builds points, a View on Strava link, and device attribution", () => {
    const p = buildImportPayload({ kind: "activity", id: "111" }, { name: "TCS NYC Marathon", device_name: "Garmin Forerunner 965" }, streams);
    expect(p).toEqual({
      kind: "activity",
      name: "TCS NYC Marathon",
      url: "https://www.strava.com/activities/111",
      device: "Garmin Forerunner 965",
      points: [
        { lat: 40.6, lon: -74.06, ele: 20, t: 0 },
        { lat: 40.61, lon: -74.05, ele: 60, t: 300 },
      ],
    });
  });

  it("links routes to the route page and leaves device empty", () => {
    const p = buildImportPayload({ kind: "route", id: "222" }, { name: "Long run loop" }, [{ type: "latlng", data: [[1, 2], [1.1, 2]] }]);
    expect(p.url).toBe("https://www.strava.com/routes/222");
    expect(p.device).toBeUndefined();
    expect(p.points[0].t).toBeUndefined();
  });

  it("refuses activities without GPS", () => {
    expect(() => buildImportPayload({ kind: "activity", id: "1" }, { name: "Treadmill" }, {})).toThrow(StravaError);
  });
});
