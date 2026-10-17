"use client";

/**
 * Manage and edit keys travel in the URL fragment (#key=…), which browsers never send to
 * the server. We also remember them on this device so links work without the fragment.
 */
const read = (k: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "{}");
  } catch {
    return {};
  }
};
const write = (k: string, v: Record<string, string>) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode: the fragment still works */
  }
};

function keyFor(store: string, id: string) {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("key");
  const all = read(store);
  if (fromHash) {
    write(store, { ...all, [id]: fromHash });
    return fromHash;
  }
  return all[id] ?? null;
}

export const manageKeyFor = (raceId: string) => keyFor("pp.manage", raceId);
export const editKeyFor = (plantId: string) => keyFor("pp.edit", plantId);
export const rememberManageKey = (raceId: string, key: string) => write("pp.manage", { ...read("pp.manage"), [raceId]: key });
export const rememberEditKey = (plantId: string, key: string) => write("pp.edit", { ...read("pp.edit"), [plantId]: key });

/** Races this device created, newest first (for the "your races" link on the home page). */
export const myRaces = () => Object.keys(read("pp.manage"));
