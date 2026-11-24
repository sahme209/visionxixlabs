"use client";

import {useEffect, useRef, useState, type FormEvent, type ReactNode} from "react";

const endpoint = "/api/dashboard/gitlab-connection";
const actionClass = "rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-50";
const fieldClass = "mt-1 w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";
const labels = {
  not_connected: "Not connected",
  bound_to_other_repository: "GitLab setup is bound to another repository in this workspace.",
  awaiting_validation: "Awaiting validation",
  active: "Read access validated", needs_attention: "Needs validation", suspended: "Suspended", revoked: "Revoked in V19",
} as const;
type Status = keyof typeof labels;
type UnboundStatus = "not_connected" | "bound_to_other_repository";
type Connection = {status: UnboundStatus} | {status: Exclude<Status, UnboundStatus>; connectionId: string; revision: string; validatedAt: string | null};
type View = {kind: "hidden"} | {kind: "unavailable"} | {kind: "ready"; connection: Connection};
type Action = "register" | "validate" | "revalidate" | "revoke";
const unconfirmed = "V19 could not confirm the update. Check the current status below.";

function confirmsUpdate(action: Action, receipt: unknown, view: View): boolean {
  if (!receipt || typeof receipt !== "object" || view.kind !== "ready" || !("connectionId" in view.connection)) return false;
  const {connection} = view;
  if (!("connectionId" in receipt) || receipt.connectionId !== connection.connectionId) return false;
  if (action === "validate" || action === "revalidate") {
    return connection.status === "active" && connection.validatedAt !== null
      && "validatedAt" in receipt && receipt.validatedAt === connection.validatedAt;
  }
  const expected = action === "register" ? "awaiting_validation" : "revoked";
  return connection.status === expected && "revision" in receipt && receipt.revision === connection.revision;
}

async function readConnection(repositoryId: string, signal: AbortSignal): Promise<View> {
  try {
    const response = await fetch(endpoint + "?" + new URLSearchParams({repositoryId}), {
      cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(7_000)]),
    });
    if ([401, 403, 404].includes(response.status)) return {kind: "hidden"};
    if (!response.ok) return {kind: "unavailable"};
    const data = await response.json();
    if (data?.status === "not_connected" || data?.status === "bound_to_other_repository") {
      return {kind: "ready", connection: {status: data.status}};
    }
    if (typeof data?.status === "string" && Object.hasOwn(labels, data.status)
      && typeof data.connectionId === "string" && typeof data.revision === "string") {
      return {kind: "ready", connection: {
        status: data.status, connectionId: data.connectionId, revision: data.revision,
        validatedAt: typeof data.validatedAt === "string" ? data.validatedAt : null,
      }};
    }
  } catch { /* A failed read does not establish connection state. */ }
  return {kind: "unavailable"};
}

export function GitLabConnectionPanel({repositoryId, children}: {repositoryId: string; children: ReactNode}) {
  const [view, setView] = useState<View>({kind: "hidden"});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const request = useRef<AbortController | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const focusStatus = useRef(false);
  const revokeButton = useRef<HTMLButtonElement>(null);
  const cancelRevoke = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void readConnection(repositoryId, controller.signal).then(result => {
      if (!controller.signal.aborted) setView(result);
    });
    return () => request.current?.abort();
  }, [repositoryId]);

  useEffect(() => {
    if (confirmRevoke) cancelRevoke.current?.focus();
  }, [confirmRevoke]);

  useEffect(() => {
    if (!busy && focusStatus.current) {
      focusStatus.current = false;
      status.current?.focus();
    }
  }, [busy, view]);

  function finish(controller: AbortController, result: View, feedback: string) {
    if (controller.signal.aborted) return;
    focusStatus.current = true;
    setView(result);
    setBusy(false);
    setMessage(feedback);
  }

  async function reload() {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const result = await readConnection(repositoryId, controller.signal);
    finish(controller, result, result.kind === "ready" ? "Connection status refreshed." : "Connection status is unavailable.");
  }

  async function submit(event: FormEvent<HTMLFormElement>, action: Action) {
    event.preventDefault();
    if (busy || view.kind !== "ready") return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const {connection} = view;
    const binding = "connectionId" in connection ? {connectionId: connection.connectionId, revision: connection.revision} : {};
    const data = action === "register"
      ? {projectId: fields.get("projectId"), projectToken: fields.get("projectToken"),
          expiresAt: Date.parse(String(fields.get("expiresAt")) + "T00:00:00Z"),
          ...("revision" in connection ? {revision: connection.revision} : {})}
      : {...binding, ...(action === "revoke" ? {} : {verifierToken: fields.get("verifierToken")})};

    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    setConfirmRevoke(false);
    for (const field of form.querySelectorAll<HTMLInputElement>('input[type="password"]')) field.value = "";
    let feedback = unconfirmed;
    let receipt: unknown;
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({action, repositoryId, ...data}),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(16_000)]),
      });
      const result = await response.json();
      if (response.ok) receipt = result;
      else if (result?.error !== "gitlab_setup_unconfirmed") {
        feedback = "GitLab setup could not be completed. Check the repository, credential and workspace access.";
      }
    } catch { /* An interrupted request may still have changed the server state. */ }
    const result = await readConnection(repositoryId, controller.signal);
    if (!controller.signal.aborted && confirmsUpdate(action, receipt, result)) {
      form.closest("details")?.removeAttribute("open");
      feedback = "Connection state updated.";
    }
    finish(controller, result, feedback);
  }

  if (view.kind === "hidden") return null;
  if (view.kind === "unavailable") return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
      <p role="status" ref={status} tabIndex={-1}>{message || "GitLab setup status is unavailable."}</p>
      <button type="button" className={actionClass} disabled={busy} onClick={reload}>Refresh GitLab status</button>
    </div>
  );

  const {connection} = view;
  const shouldRegister = ["not_connected", "awaiting_validation", "revoked"].includes(connection.status);
  const shouldValidate = ["awaiting_validation", "active", "needs_attention"].includes(connection.status);
  const canRevoke = "connectionId" in connection && connection.status !== "revoked";

  return (
    <section aria-label="GitLab read connection" className="mt-3 space-y-3 border-t border-white/10 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-100">GitLab read connection</h2>
        <button type="button" className={actionClass} disabled={busy} onClick={reload}>Refresh status</button>
      </div>
      <p ref={status} tabIndex={-1} role="status" className="text-sm text-zinc-300">
        {labels[connection.status]}{busy ? " · Checking…" : message ? " · " + message : ""}
      </p>
      {connection.status === "active" && !busy && children}
      {shouldRegister && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm text-zinc-200">{connection.status === "awaiting_validation" ? "Replace pending credential" : "Register project credential"}</summary>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => void submit(event, "register")}>
            <label className="text-sm text-zinc-300">GitLab project ID<input className={fieldClass} name="projectId" inputMode="numeric" pattern="[1-9][0-9]{0,19}" required disabled={busy} /></label>
            <label className="text-sm text-zinc-300">Expiry date (UTC)<input className={fieldClass} name="expiresAt" type="date" required disabled={busy} /></label>
            <label className="text-sm text-zinc-300 sm:col-span-2">Project token with read_api<input className={fieldClass} name="projectToken" type="password" autoComplete="new-password" maxLength={4096} required disabled={busy} /></label>
            <div><button className={actionClass} disabled={busy}>Save pending credential</button></div>
          </form>
        </details>
      )}
      {shouldValidate && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm text-zinc-200">{connection.status === "awaiting_validation" ? "Validate read access" : "Revalidate read access"}</summary>
          <form className="space-y-3" onSubmit={event => void submit(event, connection.status === "awaiting_validation" ? "validate" : "revalidate")}>
            <label className="block text-sm text-zinc-300">Separate verifier token<input className={fieldClass} name="verifierToken" type="password" autoComplete="new-password" maxLength={4096} required disabled={busy} /></label>
            <p className="text-sm text-zinc-400">Used for a single GitLab token lookup.</p>
            <button className={actionClass} disabled={busy}>Verify read access</button>
          </form>
        </details>
      )}
      {canRevoke && (confirmRevoke ? (
        <form onSubmit={event => void submit(event, "revoke")} className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-zinc-300">Remove this credential and stop V19 from syncing this project?</p>
          <button type="button" ref={cancelRevoke} className={actionClass} onClick={() => {setConfirmRevoke(false); requestAnimationFrame(() => revokeButton.current?.focus());}}>Cancel</button>
          <button className={actionClass} disabled={busy}>Confirm revoke</button>
        </form>
      ) : <button type="button" ref={revokeButton} className={actionClass} disabled={busy} onClick={() => setConfirmRevoke(true)}>Revoke in V19</button>)}
    </section>
  );
}
