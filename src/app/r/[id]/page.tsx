import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Registry } from "@/components/Registry";
import { Shell } from "@/components/Shell";
import { registrySummary } from "@/lib/server/registryMeta";

export async function generateMetadata({ params }: PageProps<"/r/[id]">): Promise<Metadata> {
  await connection(); // live progress, read per request
  const s = await registrySummary((await params).id);
  if (!s) return { title: "Plant a song · Playlist Pacer" };
  const title = `Help ${s.name} run the ${s.race}`;
  const description = `Plant a song, with a short note, at a moment along ${s.name}'s course. ${s.planted} of ${s.total} moments planted so far.`;
  return { title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
}

// The registry is per-race and always fresh; tell Next this page is intentionally dynamic.
async function Dynamic() {
  await connection();
  return null;
}

export default function RegistryPage() {
  return (
    <Shell>
      <Suspense fallback={<p className="pt-10 text-pink/60">Loading…</p>}>
        <Registry />
      </Suspense>
      <Suspense>
        <Dynamic />
      </Suspense>
    </Shell>
  );
}
