import type { Metadata } from "next";
import { Suspense } from "react";
import { EditPlant } from "@/components/EditPlant";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Your planted song · Playlist Pacer", robots: { index: false } };

export default function EditPlantPage() {
  return (
    <Shell>
      <Suspense fallback={<p className="pt-10 text-pink/60">Loading…</p>}>
        <EditPlant />
      </Suspense>
    </Shell>
  );
}
