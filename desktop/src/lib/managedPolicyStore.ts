import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseManagedPolicy, type ManagedPolicyFile, type ManagedPolicyState } from "./managedPolicy";

let pending: Promise<ManagedPolicyState> | null = null;

/** Reads the organization's policy file once per app run. Outside the desktop shell there is none. */
export function loadManagedPolicy(): Promise<ManagedPolicyState> {
  pending ??= (async () => {
    let file: ManagedPolicyFile | undefined;
    try { file = await invoke<ManagedPolicyFile>("get_managed_policy"); } catch { file = undefined; }
    return file && typeof file === "object" && "status" in file ? parseManagedPolicy(file) : { kind: "none" as const };
  })();
  return pending;
}

export function useManagedPolicy(): ManagedPolicyState | null {
  const [state, setState] = useState<ManagedPolicyState | null>(null);
  useEffect(() => { let live = true; void loadManagedPolicy().then((s) => { if (live) setState(s); }); return () => { live = false; }; }, []);
  return state;
}

/** For tests only. */
export function resetManagedPolicyForTests() { pending = null; }
