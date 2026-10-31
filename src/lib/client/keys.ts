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
/** Songs this device added, by id: lets you remove your own songs from the map. */
export const editKeys = () => read("pp.edit");
export const rememberEditKey = (plantId: string, key: string) => write("pp.edit", { ...read("pp.edit"), [plantId]: key });

/** Races this device created, newest first (for the "your races" link on the home page). */
export const myRaces = () => Object.keys(read("pp.manage"));

let sessionDevice: string | null = null;
/** A random id for this browser, kept on the device: how the server counts one person's songs. */
export function deviceId() {
  try {
    let id = localStorage.getItem("pp.device");
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem("pp.device", id);
    }
    return id;
  } catch {
    // Private mode: one id for this visit.
    return (sessionDevice ??= crypto.randomUUID().replace(/-/g, ""));
  }
}
