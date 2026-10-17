import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/martian-mono";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playlist Pacer — your race, sequenced like an album",
  description:
    "Map your race playlist onto the course. See which song hits at the Queensboro Bridge, ramp the BPM, and land your finishing banger on the last stretch.",
};

export const viewport: Viewport = {
  themeColor: "#2340c8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
