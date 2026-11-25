import "server-only";

import type { CorrelationId } from "@/lib/domain/ids";
import {
  bindAutomaticTopUpSetup, claimAutomaticTopUpSetupCreate, readAutomaticTopUpSetup, saveVerifiedAutomaticTopUpConsent,
} from "./automaticAICreditTopUpConsentStore";
import type { makeAutomaticTopUpSetupProvider } from "./automaticAICreditTopUpSetupProvider";

type Provider = ReturnType<typeof makeAutomaticTopUpSetupProvider>;
type Tx = Parameters<typeof readAutomaticTopUpSetup>[0];
type Actor = Parameters<typeof readAutomaticTopUpSetup>[1];
type SetupRepo = {
  $transaction<T>(run: (tx: Tx) => Promise<T>, options: { isolationLevel: "Serializable" }): Promise<T>;
};
const serializable = { isolationLevel: "Serializable" } as const;

/** Internal test-mode composition. Transport calls run outside DB locks.
 * After provider IO, accepted membership and the same attempt are checked
 * again before returning a client secret or saving local consent. */
export function makeAutomaticTopUpSetupService(repo: SetupRepo, provider: Provider) {
  return {
    async create(actor: Actor, attemptId: string) {
      const terms = await repo.$transaction(tx => claimAutomaticTopUpSetupCreate(tx, actor, attemptId), serializable);
      if (!terms) return { kind: "setup_inactive" } as const;
      try {
        const observed = await provider.create(terms);
        const binding = await repo.$transaction(tx => bindAutomaticTopUpSetup(tx, actor, attemptId, observed), serializable);
        if (!binding) return { kind: "setup_inactive" } as const;
        const secret = observed.setup.client_secret;
        if (!secret?.startsWith(`${binding.setupIntentId}_secret_`)) return { kind: "setup_unavailable" } as const;
        return { kind: "ready", clientSecret: secret } as const;
      } catch {
        return { kind: "setup_unavailable" } as const;
      }
    },

    async finish(actor: Actor, attemptId: string, correlationId: CorrelationId) {
      const attempt = await repo.$transaction(tx => readAutomaticTopUpSetup(tx, actor, attemptId), serializable);
      if (!attempt?.setupIntentId) return { kind: "setup_inactive" } as const;
      const binding = { ...attempt.terms, setupIntentId: attempt.setupIntentId };
      try {
        const observed = await provider.retrieve(binding);
        return await repo.$transaction(tx => saveVerifiedAutomaticTopUpConsent(tx, binding, observed, correlationId), serializable);
      } catch {
        return { kind: "setup_unavailable" } as const;
      }
    },
  };
}
