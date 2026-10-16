"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Fragment, useEffect, useRef, useState } from "react";
import { fmtClock, toUnits } from "@/lib/format";
import { useKD } from "@/lib/store";
import type { Segment } from "@/lib/types";
import type { Plan } from "@/lib/usePlan";

export function SongList({ plan }: { plan: Plan }) {
  const reorder = useKD((s) => s.reorder);
  const selectedKey = useKD((s) => s.selectedKey);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!selectedKey) return;
    listRef.current?.querySelector(`[data-key="${window.CSS.escape(selectedKey)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedKey]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = plan.tracks.findIndex((t) => t.key === active.id);
    const to = plan.tracks.findIndex((t) => t.key === over.id);
    reorder(arrayMove(plan.tracks, from, to));
  };

  const firstRace = plan.segments.findIndex((s) => s.phase === "race");
  const firstPost = plan.segments.findIndex((s) => s.phase === "post");

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={plan.tracks.map((t) => t.key)} strategy={verticalListSortingStrategy}>
        <ol ref={listRef} className="space-y-1.5">
          {plan.segments.map((seg, i) => (
            <Fragment key={seg.track.key}>
              {i === 0 && seg.phase === "corral" && <Divider label="🚦 Corral — before the start mat" />}
              {i === firstRace && <Divider label="🔫 Gun goes off" accent />}
              {i === firstPost && <Divider label="🏁 Finish line — medal walk songs" accent />}
              <Row seg={seg} plan={plan} selected={seg.track.key === selectedKey} />
            </Fragment>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Divider({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <li className={`flex items-center gap-2 px-1 pt-2 font-display text-[10px] font-black uppercase tracking-wider ${accent ? "text-acid" : "text-paper/50"}`}>
      <span className="h-[2px] w-4 bg-current" />
      {label}
      <span className="h-[2px] flex-1 bg-current opacity-40" />
    </li>
  );
}

function Row({ seg, plan, selected }: { seg: Segment; plan: Plan; selected: boolean }) {
  const { track } = seg;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.key });
  const select = useKD((s) => s.select);
  const set = useKD((s) => s.set);
  const removeTrack = useKD((s) => s.removeTrack);
  const isKick = plan.settings.kickKey === track.key;
  const u = plan.settings.units;
  const out = seg.phase !== "race";

  return (
    <li
      ref={setNodeRef}
      data-key={track.key}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={`group relative flex items-center gap-2 rounded-2xl border-2 bg-ink py-1.5 pl-1.5 pr-2 transition ${
        isDragging ? "rotate-1 scale-[1.03] border-acid shadow-[6px_6px_0_0_var(--color-hot)]" : selected ? "border-paper" : "border-transparent hover:border-paper/15"
      } ${out ? "opacity-55" : ""}`}
      onClick={() => select(selected ? null : track.key)}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag ${track.title}`}
        className="cursor-grab touch-none px-0.5 text-paper/30 hover:text-paper active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border-2 border-black" style={{ background: seg.color }}>
        {track.art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.art} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center font-display text-sm font-black text-ink">{seg.index + 1}</span>
        )}
        {track.art && <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: seg.color }} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold leading-tight">
          {isKick && <span className="mr-1 text-acid">⚡</span>}
          {track.title}
        </div>
        <div className="truncate text-xs text-paper/50">{track.artist}</div>
      </div>
      <div className="w-14 shrink-0 text-right font-mono text-[11px] leading-tight" title={seg.phase === "race" ? `${toUnits(seg.startD, u).toFixed(2)} → ${toUnits(seg.endD, u).toFixed(2)} ${u}` : undefined}>
        {seg.phase === "race" ? (
          <>
            <div className="font-bold text-paper">
              <span className="text-[9px] uppercase text-paper/40">{u} </span>
              {toUnits(seg.startD, u).toFixed(1)}
            </div>
            <div className="text-paper/40">{seg.partial ? "cut off" : fmtClock(seg.raceStart)}</div>
          </>
        ) : (
          <div className="text-paper/40">{seg.phase === "corral" ? "corral" : "post"}</div>
        )}
      </div>
      <BpmChip trackKey={track.key} bpm={track.bpm} />
      <div className="-ml-1 flex items-center">
        <button
          title={isKick ? "This is your kick song" : "Make this your kick (finisher) song"}
          aria-pressed={isKick}
          onClick={(e) => {
            e.stopPropagation();
            set({ kickKey: isKick ? null : track.key });
          }}
          className={`grid h-7 w-7 place-items-center rounded-full text-sm transition ${isKick ? "bg-acid text-ink" : "text-paper/30 hover:bg-paper/10 hover:text-acid"}`}
        >
          ⚡
        </button>
        <button
          title="Remove from plan"
          onClick={(e) => {
            e.stopPropagation();
            removeTrack(track.key);
          }}
          className="grid h-7 w-6 place-items-center rounded-full text-xs text-paper/20 opacity-0 transition hover:bg-hot/20 hover:text-hot group-hover:opacity-100 focus:opacity-100"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

function BpmChip({ trackKey, bpm }: { trackKey: string; bpm?: number }) {
  const updateTrack = useKD((s) => s.updateTrack);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(bpm ? String(bpm) : "");
  const taps = useRef<number[]>([]);

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now].slice(-9);
    if (taps.current.length >= 3) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      setVal(String(Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length))));
    }
  };
  const save = () => {
    const n = Number(val);
    updateTrack(trackKey, { bpm: n >= 40 && n <= 250 ? Math.round(n) : undefined });
    setOpen(false);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => {
          setVal(bpm ? String(bpm) : "");
          setOpen(!open);
        }}
        className={`chip font-mono ${bpm ? "text-paper/80" : "border-dashed text-hot"}`}
        title="Edit BPM"
      >
        {bpm ?? "+bpm"}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 rounded-2xl border-[3px] border-black bg-paper p-3 text-ink shadow-[4px_4px_0_#000]">
          <label className="mb-1 block font-display text-[10px] font-black uppercase">BPM</label>
          <div className="flex gap-2">
            <input
              autoFocus
              inputMode="numeric"
              value={val}
              onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-16 rounded-lg border-2 border-black px-2 py-1 font-mono font-bold"
            />
            <button onClick={tap} className="flex-1 rounded-lg border-2 border-black bg-hot font-display text-xs font-black active:scale-95">
              TAP 🥁
            </button>
          </div>
          <p className="mt-1 text-[10px] opacity-60">tap along to the beat, 4+ times</p>
          <button onClick={save} className="mt-2 w-full rounded-lg border-2 border-black bg-acid py-1 font-display text-xs font-black">
            SAVE
          </button>
        </div>
      )}
    </div>
  );
}
