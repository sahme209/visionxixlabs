/**
 * Persistent storage for the desktop app. Uses Tauri's `plugin-store`
 * which writes JSON to the app's OS-private app-data directory (encrypted
 * at rest on macOS via FileVault, Windows via DPAPI, Linux via the
 * filesystem permissions of the per-user data dir).
 *
 * Falls back to in-memory storage when the Tauri runtime isn't present
 * (e.g. when the React app is running under `vite preview` in a browser
 * for development).
 */

import { Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "axiom-desktop.dat";

let memoryStore: Map<string, unknown> | null = null;
let tauriStore: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (tauriStore) return tauriStore;
  try {
    tauriStore = await Store.load(STORE_FILE);
    return tauriStore;
  } catch {
    if (!memoryStore) memoryStore = new Map();
    return null;
  }
}

export async function readSecret<T = string>(key: string): Promise<T | undefined> {
  const store = await getStore();
  if (store) {
    const value = await store.get<T>(key);
    return value ?? undefined;
  }
  return memoryStore?.get(key) as T | undefined;
}

export async function writeSecret(key: string, value: unknown): Promise<void> {
  const store = await getStore();
  if (store) {
    await store.set(key, value);
    await store.save();
    return;
  }
  memoryStore?.set(key, value);
}

export async function clearSecret(key: string): Promise<void> {
  const store = await getStore();
  if (store) {
    await store.delete(key);
    await store.save();
    return;
  }
  memoryStore?.delete(key);
}
