import "server-only";
import Stripe from "stripe";
import type { createNewTestSubscriptionService, Store } from "../newTestSubscription/service";
import { ANNIVERSARY_POLICY_V2 } from "../newTestSubscription/anniversaryWindow";
import { bridgeCommand, bridgeResult, type Manifest, type Result } from "./protocol";
/** Worker-only composition. No credential/SDK/database factory and no Next
 * import invokes this module. The supervisor supplies the existing owned store
 * and service; an HTTP caller can supply only a validated closed command. */
export function createOwnedCheckoutOperations(options: {
  manifest: Manifest; store: Store; service: ReturnType<typeof createNewTestSubscriptionService>;
  actor(userId: string): Promise<{ email: string; seatQuantity: number } | null>;
}) {
  const manifest = Object.freeze({ ...options.manifest }), { store, service } = options;
  let busy = false;
  async function binding() {
    if (store.runtimeId !== manifest.runtimeId) throw new Error("owned_checkout_binding_changed");
    await store.transaction(async tx => {
      const state = await tx.allowance?.(manifest.organizationId);
      if (!state || state.enrollment.policy !== ANNIVERSARY_POLICY_V2 || state.enrollment.runtimeId !== manifest.runtimeId || state.enrollment.accountId !== manifest.accountId || state.enrollment.organizationId !== manifest.organizationId) throw new Error("owned_checkout_binding_changed");
      await tx.currentTime(); // The store separately enforces its actual marker.
    });
  }
  return async (input: unknown): Promise<Result> => {
    let command; try { command = bridgeCommand(input, manifest); } catch { return { kind: "invalid_request" }; }
    if (busy) return { kind: "busy" };
    busy = true;
    try {
      await binding();
      if (command.kind === "hello") return { kind: "ready" };
      if (command.kind === "reconcile") {
        const outcome = await service.reconcile(Buffer.from(command.body, "base64").toString("utf8"), command.signature, manifest.organizationId);
        return bridgeResult({ kind: "reconciled", outcome });
      }
      const scope = { organizationId: manifest.organizationId, userId: command.userId };
      const current = await store.transaction(async tx => ({ eligible: await tx.eligible(scope), intent: await tx.activeIntent(manifest.organizationId) }));
      if (!current.eligible) return { kind: "forbidden" };
      if (command.kind === "status") return bridgeResult({ kind: "intent_state", state: current.intent?.state ?? "none" });
      // No repeat create, URL reconstruction, replacement key or automatic
      // uncertain/confirmed retry. Existing durable fences are authoritative.
      if (current.intent && (current.intent.state !== "prepared" || current.intent.clientIntentKey !== command.clientIntentKey || current.intent.terms.planId !== command.planId || current.intent.terms.interval !== command.interval)) return { kind: "reconciliation_required" };
      const actor = await options.actor(command.userId);
      if (!actor || !actor.email || actor.email.length > 320 || !Number.isSafeInteger(actor.seatQuantity) || actor.seatQuantity < 1) return { kind: "forbidden" };
      const intent = await service.prepare(scope, { clientIntentKey: command.clientIntentKey, planId: command.planId, interval: command.interval, email: actor.email, seatQuantity: actor.seatQuantity, successUrl: manifest.origin + "/control/usage-billing?billing=success", cancelUrl: manifest.origin + "/plans?checkout=canceled" });
      if (intent.state !== "prepared") return { kind: "reconciliation_required" };
      const result = await service.attempt(scope, intent.id);
      await binding();
      return bridgeResult(result);
    } catch (error) {
      // Closed failure only; never forward SDK/SQL payloads or secret-bearing
      // errors. Existing service owns durable attempted/unknown/proof states.
      return { kind: error instanceof Stripe.errors.StripeSignatureVerificationError ? "invalid_signature" : "unavailable" };
    } finally { busy = false; }
  };
}
