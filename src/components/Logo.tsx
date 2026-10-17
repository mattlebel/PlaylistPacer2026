/** Vinyl-record mark + lowercase wordmark. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-ink"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 ${size * 0.15}px #0e0e14, inset 0 0 0 ${size * 0.175}px #3a3a48, inset 0 0 0 ${size * 0.3}px #0e0e14, inset 0 0 0 ${size * 0.325}px #3a3a48`,
      }}
    >
      <span className="rounded-full bg-pink" style={{ width: size * 0.3, height: size * 0.3 }} />
    </span>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} />
      <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
        playlist pacer
      </span>
    </span>
  );
}
