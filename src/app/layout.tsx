import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/martian-mono";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const base = process.env.APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();

export const metadata: Metadata = {
  // Absolute URLs for link-preview images.
  metadataBase: base ? new URL(base) : undefined,
  title: "Playlist Pacer — your marathon, soundtracked by your people",
  description:
    "Share one link and let friends and family drag songs onto the miles of your NYC Marathon course. You hear them right there on race day.",
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
