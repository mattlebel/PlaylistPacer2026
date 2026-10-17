import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageRace } from "@/components/ManageRace";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Your race · Playlist Pacer", robots: { index: false } };

export default function ManagePage() {
  return (
    <Shell cta={false}>
      <Suspense fallback={<p className="pt-10 text-pink/60">Loading…</p>}>
        <ManageRace />
      </Suspense>
    </Shell>
  );
}
