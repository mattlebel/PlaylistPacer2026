import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { registrySummary } from "@/lib/server/registryMeta";

export const alt = "Drop a song on a mile of their NYC Marathon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (w: number) =>
  readFile(join(process.cwd(), `node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-${w}-normal.woff`));

/** Link preview: "Help Matt soundtrack 26.2" on the cobalt sleeve, with progress. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const s = await registrySummary((await params).id);
  const [bold, medium] = await Promise.all([font(800), font(500)]);
  const name = s?.name ?? "your runner";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2340C8", color: "#F7D3D8", padding: 72, fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 500 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: "#0E0E14", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#F7D3D8" }} />
            </div>
            playlist pacer
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 100, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3 }}>{`Help ${name} soundtrack 26.2`}</div>
            <div style={{ fontSize: 38, fontWeight: 500, color: "#FBE6E9" }}>Drop a song on a mile of the NYC Marathon.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, fontWeight: 500 }}>
            <div style={{ display: "flex", width: 320, height: 14, borderRadius: 7, background: "rgba(14,14,20,0.3)" }}>
              <div style={{ width: `${s ? Math.min(100, (s.songs / s.capacity) * 100) : 0}%`, height: 14, borderRadius: 7, background: "#F7D3D8" }} />
            </div>
            {s ? `${s.songs} ${s.songs === 1 ? "song" : "songs"} on the course` : "Sunday, November 1"}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: bold, weight: 800, style: "normal" },
        { name: "Bricolage", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
