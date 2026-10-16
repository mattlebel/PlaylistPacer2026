"use client";

import { useMemo } from "react";
import { buildPaceModel } from "./pace";
import { computeSegments, kickReport, landmarkHits, playlistStats } from "./plan";
import { useKD } from "./store";

export function usePlan() {
  const course = useKD((s) => s.course);
  const tracks = useKD((s) => s.tracks);
  const settings = useKD((s) => s.settings);

  return useMemo(() => {
    if (!course) return null;
    const model = buildPaceModel(course, settings);
    const segments = computeSegments(tracks, settings, model);
    return {
      course,
      tracks,
      settings,
      model,
      segments,
      kick: kickReport(tracks, segments, settings, model),
      hits: landmarkHits(course.landmarks, segments),
      stats: playlistStats(tracks, segments, settings, model),
    };
  }, [course, tracks, settings]);
}

export type Plan = NonNullable<ReturnType<typeof usePlan>>;
