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
import { spotifyTrackUrl } from "@/lib/spotify";
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
  // Side B starts with the first song that begins in the second half.
  const half = plan.course.distance / 2;
  const sideB = plan.segments.findIndex((s) => s.phase === "race" && s.startD >= half);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={plan.tracks.map((t) => t.key)} strategy={verticalListSortingStrategy}>
        <ol ref={listRef} className="space-y-1.5">
          {plan.segments.map((seg, i) => (
            <Fragment key={seg.track.key}>
              {i === 0 && seg.phase === "corral" && <Divider label="In the corral" />}
              {i === firstRace && <Divider label="Side A · from the start" accent />}
              {i === sideB && <Divider label="Side B · second half" accent />}
              {i === firstPost && <Divider label="After the finish" />}
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
    <li className={`flex items-center gap-2 px-1 pt-2 font-mono text-[10px] uppercase tracking-wider ${accent ? "text-chalk" : "text-pink/50"}`}>
      <span className="h-px w-4 bg-current" />
      {label}
      <span className="h-px flex-1 bg-current opacity-40" />
    </li>
  );
}

function Row({ seg, plan, selected }: { seg: Segment; plan: Plan; selected: boolean }) {
  const { track } = seg;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.key });
  const select = useKD((s) => s.select);
  const set = useKD((s) => s.set);
  const removeTrack = useKD((s) => s.removeTrack);
  const isCloser = plan.settings.closerKey === track.key;
  const u = plan.settings.units;
  const out = seg.phase !== "race";

  return (
    <li
      ref={setNodeRef}
      data-key={track.key}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={`group relative flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition ${
        isDragging ? "scale-[1.02] bg-ink-2 shadow-[0_12px_30px_rgb(8_10_40/0.4)]" : selected ? "bg-ink/35 ring-1 ring-pink" : "hover:bg-ink/20"
      } ${out ? "opacity-55" : ""}`}
      onClick={() => select(selected ? null : track.key)}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag ${track.title}`}
        className="cursor-grab touch-none px-0.5 text-pink/30 hover:text-pink active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      {/* Segment color sits beside the art: Spotify artwork must not be overlaid. */}
      <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: seg.color }} />
      {track.art && track.spotifyId ? (
        <a
          href={spotifyTrackUrl(track.spotifyId)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Play ${track.title} on Spotify`}
          title="Play on Spotify"
          className="h-10 w-10 shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.art} alt="" className="h-full w-full rounded-[4px] object-cover" />
        </a>
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] font-mono text-[11px] text-ink" style={{ background: seg.color }}>
          {String(seg.index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight" title={track.title}>
          {isCloser && <span className="mr-1 text-chalk">★</span>}
          {track.title}
        </div>
        <div className="truncate text-xs text-pink/60" title={track.artist}>
          {track.artist}
        </div>
      </div>
      <div className="w-14 shrink-0 text-right font-mono text-[11px] leading-tight" title={seg.phase === "race" ? `${toUnits(seg.startD, u).toFixed(2)} → ${toUnits(seg.endD, u).toFixed(2)} ${u}` : undefined}>
        {seg.phase === "race" ? (
          <>
            <div className="font-bold text-pink">
              <span className="text-[9px] uppercase text-pink/40">{u} </span>
              {toUnits(seg.startD, u).toFixed(1)}
            </div>
            <div className="text-pink/40">{seg.partial ? "cut off" : fmtClock(seg.raceStart)}</div>
          </>
        ) : (
          <div className="text-pink/40">{seg.phase === "corral" ? "corral" : "post"}</div>
        )}
      </div>
      <BpmChip trackKey={track.key} bpm={track.bpm} />
      <div className="-ml-1 flex items-center">
        <button
          title={isCloser ? "Your closing track" : "Make this your closing track"}
          aria-label={isCloser ? `${track.title} is your closing track` : `Make ${track.title} your closing track`}
          aria-pressed={isCloser}
          onClick={(e) => {
            e.stopPropagation();
            set({ closerKey: isCloser ? null : track.key });
          }}
          className={`grid h-7 w-7 place-items-center rounded-full text-sm transition ${isCloser ? "bg-pink text-ink" : "text-pink/30 hover:bg-pink/10 hover:text-chalk"}`}
        >
          ★
        </button>
        <button
          title="Remove from plan"
          aria-label={`Remove ${track.title}`}
          onClick={(e) => {
            e.stopPropagation();
            removeTrack(track.key);
          }}
          className="grid h-7 w-6 place-items-center rounded-full text-xs text-pink/20 opacity-0 transition hover:bg-coral/20 hover:text-coral group-hover:opacity-100 focus:opacity-100"
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
        className={`chip font-mono ${bpm ? "text-pink/80" : "border-dashed text-coral"}`}
        title="Edit BPM"
      >
        {bpm ?? "+bpm"}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 rounded-xl bg-pink p-3 text-ink shadow-[0_16px_40px_rgb(8_10_40/0.4)]">
          <label className="label mb-1 block">BPM</label>
          <div className="flex gap-2">
            <input
              autoFocus
              inputMode="numeric"
              value={val}
              onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-16 rounded-lg bg-blush px-2 py-1 font-mono"
            />
            <button onClick={tap} className="flex-1 rounded-lg bg-ink text-xs font-semibold text-pink active:scale-95">
              Tap
            </button>
          </div>
          <p className="mt-1 text-[10px] opacity-60">tap along to the beat, 4+ times</p>
          <button onClick={save} className="mt-2 w-full rounded-lg bg-ground py-1.5 text-xs font-semibold text-pink">
            Save
          </button>
        </div>
      )}
    </div>
  );
}
