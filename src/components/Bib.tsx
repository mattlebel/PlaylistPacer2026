/**
 * A race bib drawn in code: the runner's number, name and wave on bib paper, with pin holes.
 * Styled after a marathon bib without any race or sponsor logos.
 */
export function Bib({
  number,
  name,
  wave,
  start,
  size = "md",
  className = "",
}: {
  number: string;
  name: string;
  wave?: string;
  start?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s = { sm: { w: 220, num: 54 }, md: { w: 300, num: 76 }, lg: { w: 420, num: 112 } }[size];
  return (
    <figure
      className={`relative select-none overflow-hidden rounded-[10px] bg-[#f7f5ef] text-ink shadow-[0_18px_40px_rgb(8_10_40/0.45)] ${className}`}
      style={{ width: s.w, aspectRatio: "1.32" }}
      aria-label={`Bib ${number}, ${name}${wave ? `, ${wave}` : ""}`}
    >
      {/* Paper texture: a soft sheen and faint fibres. */}
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgb(255_255_255/0.9),transparent_60%)]" />
      <span aria-hidden className="absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(115deg,#000_0_1px,transparent_1px_6px)]" />

      {/* Top band */}
      <div className="relative flex items-center justify-between bg-ground px-[7%] py-[3.2%] text-pink">
        <span className="font-display font-extrabold tracking-tight" style={{ fontSize: s.w * 0.06 }}>
          NYC MARATHON
        </span>
        <span className="font-mono font-semibold" style={{ fontSize: s.w * 0.036 }}>
          NOV 1 · 2026
        </span>
      </div>

      {/* Number */}
      <div className="relative flex flex-col items-center justify-center" style={{ height: "52%" }}>
        <span className="font-display font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: s.num }}>
          {number}
        </span>
        <span className="mt-[2%] font-display font-extrabold uppercase tracking-[0.18em]" style={{ fontSize: s.w * 0.07 }}>
          {name}
        </span>
      </div>

      {/* Bottom strip: wave and start, like the tear-off tab */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t-2 border-dashed border-ink/25 px-[7%] font-mono font-semibold uppercase"
        style={{ height: "17%", fontSize: s.w * 0.038 }}
      >
        <span>{wave ?? "Runner"}</span>
        {start && <span>Start {start}</span>}
        <span className="rounded-full bg-ink px-[3%] py-[1%] text-pink">26.2</span>
      </div>

      {/* Safety-pin holes */}
      {["left-[4%] top-[18%]", "right-[4%] top-[18%]", "left-[4%] bottom-[22%]", "right-[4%] bottom-[22%]"].map((pos) => (
        <span key={pos} aria-hidden className={`absolute ${pos} h-[5%] w-[3.8%] rounded-full bg-ground/80 shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)]`} />
      ))}
    </figure>
  );
}
