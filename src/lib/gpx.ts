import type { RawPoint } from "./geo";

/** Parse GPX (tracks or routes). Runs in the browser via DOMParser. */
export function parseGpx(text: string): { name: string; points: RawPoint[] } {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("That file isn't valid GPX. Try exporting it again.");
  }
  let nodes = Array.from(doc.getElementsByTagName("trkpt"));
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName("rtept"));
  if (!nodes.length) throw new Error("No track points found in that GPX.");

  let t0: number | undefined;
  const points: RawPoint[] = nodes.map((n) => {
    const ele = n.getElementsByTagName("ele")[0]?.textContent;
    const time = n.getElementsByTagName("time")[0]?.textContent;
    let t: number | undefined;
    if (time) {
      const ms = Date.parse(time);
      if (!Number.isNaN(ms)) {
        t0 ??= ms;
        t = (ms - t0) / 1000;
      }
    }
    return {
      lat: parseFloat(n.getAttribute("lat") ?? "0"),
      lon: parseFloat(n.getAttribute("lon") ?? "0"),
      ele: ele ? parseFloat(ele) : undefined,
      t,
    };
  });

  const name =
    doc.querySelector("trk > name")?.textContent?.trim() ||
    doc.querySelector("rte > name")?.textContent?.trim() ||
    doc.querySelector("metadata > name")?.textContent?.trim() ||
    "Mystery Course";
  return { name, points };
}
