import type { desktopClient } from "./desktopClient";

export type ReleaseClosureDraft = {
  reference: string;
  summary: string;
  busy?: "record" | "check";
  notice?: { kind: "unconfirmed" | "refused" | "open"; message: string };
};

export function createReleaseClosureDrafts(config: typeof desktopClient.config, revision: number) {
  let drafts: ReadonlyMap<string, ReleaseClosureDraft> = new Map();
  const listeners = new Set<() => void>();

  return {
    config,
    revision,
    getSnapshot: () => drafts,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set(key: string, draft: ReleaseClosureDraft | undefined) {
      const next = new Map(drafts);
      if (draft) next.set(key, draft);
      else next.delete(key);
      drafts = next;
      for (const listener of listeners) listener();
    },
  };
}
