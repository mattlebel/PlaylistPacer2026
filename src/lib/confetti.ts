"use client";

/** Tiny dependency-free confetti burst. */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 3) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:80";
  c.width = window.innerWidth * devicePixelRatio;
  c.height = window.innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const ctx = c.getContext("2d")!;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const colors = ["#d4ff3a", "#ff3da5", "#3ddcff", "#ff7a1a", "#b69cff", "#ffe53d"];
  const bits = Array.from({ length: 140 }, () => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 8,
    h: 4 + Math.random() * 6,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const b of bits) {
      b.vy += 0.45;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (++frame < 150) requestAnimationFrame(tick);
    else c.remove();
  };
  tick();
}
