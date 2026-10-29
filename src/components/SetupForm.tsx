"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { rememberManageKey } from "@/lib/client/keys";
import { RACE } from "@/lib/race";

export function SetupForm() {
  const router = useRouter();
  const [runnerName, setName] = useState("");
  const [runnerEmail, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runnerName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ id: string; manageKey: string }>("/api/races", {
        method: "POST",
        body: JSON.stringify({ runnerName, runnerEmail: runnerEmail.trim() || undefined }),
      });
      rememberManageKey(res.id, res.manageKey);
      router.push(`/r/${res.id}/manage?new=1#key=${res.manageKey}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't create your link. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-8 pt-4">
      <div>
        <div className="label">
          {RACE.name} · {RACE.dateLabel}
        </div>
        <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Get your link</h1>
        <p className="mt-3 text-lg text-blush">Friends open it, see the course, and drop songs onto the miles. That&apos;s it.</p>
      </div>

      <section className="panel space-y-5 p-6">
        <div>
          <label htmlFor="runner-name" className="label mb-2 block">
            Your name
          </label>
          <input id="runner-name" className="field" placeholder="Matt Lebel" value={runnerName} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={40} />
          <p className="mt-1 text-xs text-pink/60">Friends see your first name: &quot;Help Matt soundtrack 26.2&quot;.</p>
        </div>
        <div>
          <label htmlFor="runner-email" className="label mb-2 block">
            Email (optional)
          </label>
          <input id="runner-email" type="email" className="field" placeholder="you@example.com" value={runnerEmail} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <p className="mt-1 text-xs text-pink/60">We&apos;ll send your private link so you don&apos;t lose it.</p>
        </div>
      </section>

      {err && (
        <p role="alert" className="font-semibold text-coral">
          {err}
        </p>
      )}
      <button type="submit" className="btn bg-pink px-8 py-4 text-base" disabled={!runnerName.trim() || busy}>
        {busy ? "Generating…" : "Generate my link"}
      </button>
    </form>
  );
}
