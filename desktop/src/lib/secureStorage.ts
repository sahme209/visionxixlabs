/**
 * Secret storage for the desktop app. The packaged application delegates to
 * Rust commands backed by the operating-system credential vault (Keychain,
 * Credential Manager, or Secret Service).
 *
 * Falls back to in-memory storage when the Tauri runtime isn't present
 * (e.g. when the React app is running under `vite preview` in a browser
 * for development).
 */

import { invoke } from "@tauri-apps/api/core";

let memoryStore: Map<string, unknown> | null = null;
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function readSecret<T = string>(key: string): Promise<T | undefined> {
  if (isTauri()) {
    const value = await invoke<T | null>("read_secure_value", { key });
    return value ?? undefined;
  }
  if (!memoryStore) memoryStore = new Map();
  return memoryStore?.get(key) as T | undefined;
}

export async function writeSecret(key: string, value: unknown): Promise<void> {
  if (isTauri()) {
    await invoke("write_secure_value", { key, value });
    return;
  }
  if (!memoryStore) memoryStore = new Map();
  memoryStore?.set(key, value);
}

export async function clearSecret(key: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_secure_value", { key });
    return;
  }
  memoryStore?.delete(key);
}
