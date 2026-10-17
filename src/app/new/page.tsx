import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { SetupForm } from "@/components/SetupForm";

export const metadata: Metadata = { title: "Set up your race · Playlist Pacer" };

export default function NewRace() {
  return (
    <Shell cta={false}>
      <SetupForm />
    </Shell>
  );
}
