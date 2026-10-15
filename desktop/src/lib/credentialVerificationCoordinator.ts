type VerificationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CredentialVerificationCoordinator {
  verify(): Promise<void>;
  invalidate(): void;
  dispose(): void;
}

/** Apply only the latest result for the same immutable credential context.
 * Callbacks are synchronous; the coordinator never reads or deletes a vault. */
export function createCredentialVerificationCoordinator<T>(options: {
  readContext: () => { version: unknown; present: boolean };
  verify: () => Promise<VerificationResult<T>>;
  onVerified: (identity: T) => void;
  onRejected: (error: string) => void;
  onMissing: () => void;
}): CredentialVerificationCoordinator {
  let generation = 0;
  let disposed = false;
  return {
    invalidate() { generation++; },
    dispose() { disposed = true; generation++; },
    async verify() {
      if (disposed) return;
      const request = ++generation;
      const context = options.readContext();
      if (!context.present) { options.onMissing(); return; }
      let result: VerificationResult<T>;
      try { result = await options.verify(); }
      catch { result = { ok: false, error: "The workspace service could not be reached. Try signing in again." }; }
      const current = options.readContext();
      if (disposed || request !== generation || current.version !== context.version || !current.present) return;
      if (result.ok) options.onVerified(result.data);
      else options.onRejected(result.error);
    },
  };
}
