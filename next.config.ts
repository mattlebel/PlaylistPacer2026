import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Database drivers load native/WASM pieces at runtime; keep them out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  partialPrefetching: true,
  // The street map and map worker never change between refreshes, so phones can keep them: repeat
  // visits load the map instantly and use no data. A refreshed map reaches everyone within a week.
  headers: () => [
    { source: "/basemap/tiles/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }] },
    { source: "/basemap/basemap.json", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    { source: "/vendor/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
