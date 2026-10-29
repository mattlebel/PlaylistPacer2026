import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function Shell({ children, cta = true }: { children: ReactNode; cta?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Playlist Pacer home">
          <Logo size={38} />
        </Link>
        {cta && (
          <Link href="/new" className="btn btn-ghost px-4 py-2 text-sm">
            Get your link
          </Link>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">{children}</main>
      <footer className="border-t border-pink/15 px-6 py-6 text-center font-mono text-[10px] text-pink/50">
        Playlist Pacer · made for the NYC Marathon · not affiliated with NYRR or Spotify
      </footer>
    </div>
  );
}
