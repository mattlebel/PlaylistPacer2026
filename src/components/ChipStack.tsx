/**
 * A little stack of poker chips: one per song a mile can hold, filled from the bottom up.
 * Reads like a battery: you can see at a glance how much room a mile has left.
 */
const COLORS = ["#F7D3D8", "#FFE08A", "#8FE3C0", "#9DB8FF", "#C3B5F7", "#FFB38A"];

const SIZES = {
  sm: { w: 18, h: 5, gap: 2 },
  md: { w: 30, h: 7, gap: 3 },
  lg: { w: 46, h: 10, gap: 4 },
} as const;

export function ChipStack({ count, max, size = "md", className = "" }: { count: number; max: number; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span aria-hidden className={`flex flex-col-reverse items-center ${className}`} style={{ gap: s.gap }}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < count;
        return (
          <span
            key={i}
            className="block rounded-full transition-colors duration-300"
            style={{
              width: s.w,
              height: s.h,
              background: on ? COLORS[i % COLORS.length] : "transparent",
              boxShadow: on ? "0 1.5px 0 rgb(0 0 0 / 0.45)" : `inset 0 0 0 1px rgb(247 211 216 / 0.28)`,
            }}
          />
        );
      })}
    </span>
  );
}
