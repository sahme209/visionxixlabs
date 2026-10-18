/** Specific owned Checkout fixture lifecycle. No import spawns or signals.
 * Identity/ledger pattern adapted from the reviewed premium owned rehearsal. */
import type { ChildProcess } from "node:child_process";
import { readFileSync, readdirSync, realpathSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
export function ownedCheckoutControl(duration = 150000) {
  const abort = new AbortController(), deadline = performance.now() + duration;
  let failure: Error | null = null, disposed = false;
  const cancel = (error = new Error("owned_checkout_rehearsal_cancelled")) => { if (!failure) { failure = error; abort.abort(error); } };
  const check = () => { if (disposed) throw new Error("owned_checkout_rehearsal_disposed"); if (performance.now() >= deadline) cancel(new Error("owned_checkout_rehearsal_deadline")); if (failure) throw failure; };
  const timer = setTimeout(() => cancel(new Error("owned_checkout_rehearsal_deadline")), duration);
  const signals = () => cancel(new Error("owned_checkout_rehearsal_interrupted")); process.on("SIGINT", signals); process.on("SIGTERM", signals);
  return { signal: abort.signal, cancel, check, run<T>(start: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try { check(); } catch (error) { reject(error); return; }
      let settled = false;
      const finish = (error: unknown, value?: T) => { if (settled) return; settled = true; abort.signal.removeEventListener("abort", cancelled); if (error) reject(error); else resolve(value!); };
      const cancelled = () => finish(failure); abort.signal.addEventListener("abort", cancelled, { once: true });
      // Observe late rejection even when cancellation wins; owned resources are
      // separately retained in the process ledger until bounded verified cleanup.
      try { Promise.resolve(start()).then(value => { try { check(); finish(null, value); } catch (error) { finish(error); } }, error => finish(error)); } catch (error) { finish(error); }
    });
  }, dispose() { disposed = true; clearTimeout(timer); process.removeListener("SIGINT", signals); process.removeListener("SIGTERM", signals); } };
}
type Owner = { pid: number; group: number; start: string; state: string; executable: string };
function stat(pid: number) { const raw = readFileSync(`/proc/${pid}/stat`, "utf8"), fields = raw.slice(raw.lastIndexOf(")") + 2).split(" "); return { pid, group: Number(fields[2]), start: fields[19], state: fields[0] }; }
const gone = (error: unknown) => ["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "");
function snapshot(pid: number): Owner { return { ...stat(pid), executable: realpathSync(`/proc/${pid}/exe`) }; }
function members(group: number) {
  const rows: Owner[] = [];
  for (const name of readdirSync("/proc").filter(n => /^\d+$/.test(n))) {
    const pid = Number(name); let before;
    try { before = stat(pid); } catch (error) { if (gone(error)) continue; throw error; }
    if (before.group !== group || before.state === "Z") continue;
    let executable = "", metadataError: unknown;
    try { executable = realpathSync(`/proc/${pid}/exe`); } catch (error) { metadataError = error; }
    let after; try { after = stat(pid); } catch (error) { if (gone(error)) continue; throw error; }
    if (before.start !== after.start || before.group !== after.group) throw new Error("owned_checkout_process_identity_changed");
    if (after.state === "Z") continue; if (metadataError) throw metadataError; rows.push({ ...after, executable });
  }
  return rows;
}
const system = { parentGroup: () => stat(process.pid).group, canonical: () => realpathSync(process.execPath), snapshot, members, signal: (group: number, signal: "SIGTERM" | "SIGKILL") => { try { process.kill(group, signal); } catch (error) { if (!gone(error)) throw error; } },
  persist(directory: string, role: string, row: unknown) { const path = resolve(directory, `${role}-process.json`), temporary = path + ".pending"; writeFileSync(temporary, JSON.stringify(row), { mode: 0o600, flush: true }); renameSync(temporary, path); },
};
type ProcessIO = typeof system;
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function boundedWait(done: () => boolean, duration: number) { const end = performance.now() + duration; while (!done() && performance.now() < end) await pause(20); return done(); }
export function ownedCheckoutChild(role: "worker" | "next", directory: string, launch: () => ChildProcess, control: ReturnType<typeof ownedCheckoutControl>, io: ProcessIO = system) {
  const record: { role: string; pid: number | null; expected: string; owner: Owner | null; observed: Owner[]; state: "pending" | "registered" | "never_spawned" | "exited"; exited: boolean } = { role, pid: null, expected: io.canonical(), owner: null, observed: [], state: "pending", exited: false };
  let launchInvoked = false, cleaning = false, journalFailed = false, registrationClosed = false, stopPromise: Promise<void> | undefined, child: ChildProcess | undefined;
  let readyResolve!: () => void, readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; }); ready.catch(() => {});
  const fail = () => { const error = new Error("owned_checkout_child_lifecycle_failed"); control.cancel(error); readyReject(error); };
  const publish = () => { try { io.persist(directory, role, record); } catch { journalFailed = true; fail(); } };
  publish(); // Durable pending launch intent before invoking spawn/fork.
  if (journalFailed) readyReject(new Error("owned_checkout_process_journal_failed"));
  else try {
    control.check(); launchInvoked = true; child = launch(); record.pid = child.pid ?? null; publish();
    child.once("spawn", () => {
      try {
        if (registrationClosed || record.exited || !Number.isSafeInteger(record.pid) || record.pid! <= 0 || record.pid === process.pid) throw new Error("invalid");
        const owner = io.snapshot(record.pid!);
        if (owner.pid !== record.pid || owner.group !== record.pid || owner.group === io.parentGroup() || owner.executable !== record.expected || owner.state === "Z" || !/^\d+$/.test(owner.start)) throw new Error("invalid");
        const observed = io.members(owner.group);
        if (observed.length > 16 || observed.some(row => row.group !== owner.group || BigInt(row.start) < BigInt(owner.start) || row.executable !== owner.executable)) throw new Error("invalid");
        record.owner = owner; record.observed = observed; record.state = "registered"; publish(); if (journalFailed) throw new Error("invalid"); readyResolve();
      } catch { fail(); }
    });
    child.on("error", () => { if (!Number.isInteger(child?.pid) && record.owner === null && record.pid === null) record.state = "never_spawned"; publish(); if (!cleaning) fail(); else readyReject(new Error("owned_checkout_child_spawn_failed")); });
    child.on("exit", () => { record.exited = true; record.state = "exited"; publish(); if (!cleaning) fail(); });
    for (const stream of [child.stdout, child.stderr]) stream?.on("error", () => { if (!cleaning) fail(); });
  } catch { if (!launchInvoked) record.state = "never_spawned"; publish(); fail(); }
  function stop() {
    if (stopPromise) return stopPromise;
    cleaning = true;
    stopPromise = (async () => {
      // Bounded registration, independent of cancelled work and without turning
      // a timeout/no PID into proof that no process ever existed.
      await boundedWait(() => record.owner !== null || record.state === "never_spawned" || record.exited, 2000); registrationClosed = true;
      if (record.owner) {
        const owner = record.owner;
        const known = new Map(record.observed.map(row => [row.pid, row]));
        const currentMembers = () => {
          let leaderPresent = false;
          try { const current = io.snapshot(owner.pid); if (current.pid !== owner.pid || current.start !== owner.start || current.group !== owner.group || current.executable !== owner.executable) throw new Error("owned_checkout_cleanup_identity_refused"); leaderPresent = !record.exited; } catch (error) { if (!gone(error)) throw error; }
          const rows = io.members(owner.group);
          if (owner.group !== owner.pid || owner.group === process.pid || owner.group === io.parentGroup() || rows.length > 16 || rows.some(row => row.group !== owner.group || BigInt(row.start) < BigInt(owner.start) || row.executable !== owner.executable)) throw new Error("owned_checkout_cleanup_identity_refused");
          let changed = false;
          for (const row of rows) {
            const prior = known.get(row.pid);
            // Once the original leader has exited, an unseen/reused member
            // cannot establish continuity of this group. Retain it as unknown.
            if (prior ? prior.start !== row.start || prior.executable !== row.executable : !leaderPresent) throw new Error("owned_checkout_cleanup_identity_refused");
            if (!prior) { known.set(row.pid, row); changed = true; }
          }
          if (changed) { record.observed = [...known.values()]; publish(); } if (journalFailed) throw new Error("owned_checkout_process_journal_failed"); return rows;
        };
        if (currentMembers().length) { io.signal(-owner.group, "SIGTERM"); if (!await boundedWait(() => currentMembers().length === 0, 2000)) { currentMembers(); io.signal(-owner.group, "SIGKILL"); if (!await boundedWait(() => currentMembers().length === 0, 1000)) throw new Error("owned_checkout_cleanup_group_incomplete"); } }
        if (!await boundedWait(() => record.exited, 1000)) throw new Error("owned_checkout_cleanup_exit_unverified");
      } else if (record.state !== "never_spawned") throw new Error("owned_checkout_cleanup_pending_unknown");
      if (journalFailed) throw new Error("owned_checkout_process_journal_failed");
    })();
    return stopPromise;
  }
  return { ready, child, stop, record };
}
export async function cleanupOwnedCheckout(closers: Array<() => Promise<void>>) {
  const results = await Promise.allSettled(closers.map(close => Promise.resolve().then(close)));
  if (results.some(result => result.status === "rejected")) throw new Error("owned_checkout_cleanup_unverified");
}
