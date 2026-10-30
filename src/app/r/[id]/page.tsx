import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Registry } from "@/components/Registry";
import { Shell } from "@/components/Shell";
import { registrySummary } from "@/lib/server/registryMeta";

export async function generateMetadata({ params }: PageProps<"/r/[id]">): Promise<Metadata> {
  await connection(); // live progress, read per request
  const s = await registrySummary((await params).id);
  if (!s) return { title: "Soundtrack a marathon · Playlist Pacer" };
  const title = `Help ${s.name} soundtrack the ${s.race}`;
  const description = `Drop a song on a mile of ${s.name}'s course and they'll hear it right there on race day. ${s.songs} ${s.songs === 1 ? "song" : "songs"} so far, ${s.milesOpen} of ${s.miles} miles with room.`;
  return { title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
}

// The registry is per-race and always fresh; tell Next this page is intentionally dynamic.
async function Dynamic() {
  await connection();
  return null;
}

export default function RegistryPage() {
  return (
    <Shell cta={false}>
      <Suspense fallback={<p className="pt-10 text-pink/60">Loading…</p>}>
        <Registry />
      </Suspense>
      <Suspense>
        <Dynamic />
      </Suspense>
    </Shell>
  );
}
