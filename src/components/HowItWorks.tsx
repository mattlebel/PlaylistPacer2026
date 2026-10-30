"use client";

import { useEffect, useState } from "react";

/**
 * Little looping illustrations for the three "How it works" steps, drawn in SVG with built-in SVG
 * animation (no libraries). With reduced motion on, each shows its finished frame instead.
 */

const INK = "#0E0E14";
const PANEL = "#16288C";
const PINK = "#F7D3D8";
const BUTTER = "#FFE08A";
const MINT = "#8FE3C0";
const DUR = "4s";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  return reduced;
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 100" className="h-[84px] w-[134px] shrink-0 rounded-xl" role="img" aria-label={label}>
      <rect width="160" height="100" rx="12" fill={PANEL} />
      {children}
    </svg>
  );
}

/** Step 1: typing in the search box, then a result pops in and gets picked. */
export function FindASong() {
  const still = useReducedMotion();
  return (
    <Frame label="Typing a song into the search box and picking a result">
      <defs>
        <clipPath id="hiw-typed">
          <rect x="34" y="18" height="18" width={still ? 70 : 0}>
            {!still && <animate attributeName="width" dur={DUR} repeatCount="indefinite" values="0;0;70;70" keyTimes="0;0.08;0.4;1" />}
          </rect>
        </clipPath>
      </defs>
      <rect x="12" y="14" width="136" height="26" rx="13" fill={INK} stroke={PINK} strokeOpacity="0.45" />
      <circle cx="24" cy="26" r="4" fill="none" stroke={PINK} strokeWidth="1.5" />
      <path d="M27 29l3 3" stroke={PINK} strokeWidth="1.5" strokeLinecap="round" />
      <text x="34" y="30.5" fontSize="10" fontFamily="ui-monospace, monospace" fill={PINK} clipPath="url(#hiw-typed)">
        brightside
      </text>
      {!still && (
        <rect y="20" width="1.5" height="12" fill={PINK}>
          <animate attributeName="x" dur={DUR} repeatCount="indefinite" values="34;34;104;104" keyTimes="0;0.08;0.4;1" />
          <animate attributeName="opacity" dur="0.8s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.5;1" />
        </rect>
      )}
      <g opacity={still ? 1 : 0}>
        {!still && (
          <>
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.45;0.55;0.95;1" />
            <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite" values="0 6;0 6;0 0;0 0" keyTimes="0;0.45;0.55;1" />
          </>
        )}
        <rect x="12" y="48" width="136" height="38" rx="9" fill="#1B32A8" stroke={PINK} strokeWidth="1.5" strokeOpacity={still ? 1 : 0}>
          {!still && <animate attributeName="stroke-opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.68;0.72;0.95;1" />}
        </rect>
        <rect x="19" y="54" width="26" height="26" rx="3" fill={BUTTER} />
        <rect x="52" y="58" width="60" height="6" rx="3" fill={PINK} />
        <rect x="52" y="69" width="40" height="5" rx="2.5" fill={PINK} opacity="0.5" />
      </g>
    </Frame>
  );
}

const COURSE = "M16 88 C 40 74, 48 62, 70 60 S 116 44, 146 16";

function Marker({ x, y, filled }: { x: number; y: number; filled: number }) {
  return (
    <g>
      <rect x={x} y={y} width="20" height="30" rx="4" fill={INK} stroke={PINK} strokeOpacity="0.4" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 4} y={y + 22 - i * 7} width="12" height="4.5" rx="2.25" fill={i < filled ? [PINK, BUTTER, MINT][i] : "none"} stroke={PINK} strokeOpacity="0.3" />
      ))}
    </g>
  );
}

/** Step 2: a song bubble is dragged onto a mile marker, and the marker's stack fills. */
export function DragOntoAMile() {
  const still = useReducedMotion();
  return (
    <Frame label="Dragging a song bubble onto a mile marker">
      <path d={COURSE} fill="none" stroke={PINK} strokeWidth="3" strokeLinecap="round" />
      <Marker x={98} y={14} filled={1} />
      {/* The second chip fills when the bubble lands. */}
      <rect x="102" y="29" width="12" height="4.5" rx="2.25" fill={BUTTER} opacity={still ? 1 : 0}>
        {!still && <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.6;0.62;0.95;1" />}
      </rect>
      {!still && (
        <g>
          <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite" values="8 70;8 70;80 22;80 22" keyTimes="0;0.12;0.55;1" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1" />
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.1;0.56;0.6;1" />
          <rect width="46" height="16" rx="8" fill={PINK} />
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill={BUTTER} />
          <rect x="17" y="5.5" width="22" height="5" rx="2.5" fill={INK} opacity="0.7" />
          {/* finger */}
          <circle cx="36" cy="14" r="5" fill="#fff" opacity="0.85" />
        </g>
      )}
      <circle cx="108" cy="29" r="12" fill="none" stroke={BUTTER} strokeWidth="2" opacity="0">
        {!still && (
          <>
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;0.9;0;0" keyTimes="0;0.6;0.62;0.8;1" />
            <animate attributeName="r" dur={DUR} repeatCount="indefinite" values="12;12;12;22;22" keyTimes="0;0.6;0.62;0.8;1" />
          </>
        )}
      </circle>
    </Frame>
  );
}

/** Step 3: the runner moves along the course, and music pops out at the mile. */
export function HearItOutThere() {
  const still = useReducedMotion();
  return (
    <Frame label="The runner reaches the mile and the song plays">
      <path d={COURSE} fill="none" stroke={PINK} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <Marker x={60} y={26} filled={3} />
      <circle r="5" fill="#fff" cx={still ? 72 : 0} cy={still ? 60 : 0}>
        {!still && <animateMotion dur={DUR} repeatCount="indefinite" path={COURSE} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />}
      </circle>
      {[
        { x: 82, y: 50, d: 0 },
        { x: 92, y: 44, d: 0.06 },
        { x: 74, y: 42, d: 0.12 },
      ].map((n, i) => (
        <text key={i} x={n.x} y={n.y} fontSize="13" fill={[BUTTER, MINT, PINK][i]} opacity={still ? 1 : 0}>
          ♪
          {!still && (
            <>
              <animate
                attributeName="opacity"
                dur={DUR}
                repeatCount="indefinite"
                values="0;0;1;0;0"
                keyTimes={`0;${0.42 + n.d};${0.5 + n.d};${0.78 + n.d};1`}
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                dur={DUR}
                repeatCount="indefinite"
                values="0 0;0 0;0 -16;0 -16"
                keyTimes={`0;${0.42 + n.d};${0.78 + n.d};1`}
              />
            </>
          )}
        </text>
      ))}
    </Frame>
  );
}
