"use client";

import type { getManage, getOwnPlant, getRegistry } from "@/lib/server/repo";
import type { Song } from "@/lib/types";

export type Registry = Awaited<ReturnType<typeof getRegistry>>;
export type Manage = Awaited<ReturnType<typeof getManage>>;
export type OwnPlant = Awaited<ReturnType<typeof getOwnPlant>>;

export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { key?: { header: string; value: string } } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.key) headers[init.key.header] = init.key.value;
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, body.code, res.status);
  return body as T;
}

export interface SearchResponse {
  configured: boolean;
  results: Song[];
  error?: string;
}

export const searchSongs = (q: string) => api<SearchResponse>(`/api/songs/search?q=${encodeURIComponent(q)}`);
