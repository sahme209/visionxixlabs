import "server-only";

export async function withGithubAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = () => reject(new Error("read_aborted")); });
  signal.addEventListener("abort", rejectAbort, { once: true });
  try { return await Promise.race([promise, aborted]); }
  finally { signal.removeEventListener("abort", rejectAbort); }
}


export interface GithubReadBudget { remainingBytes: number }
export async function readBoundedGithubBody(response: Response, signal: AbortSignal, maxBytes: number, budget?: GithubReadBudget): Promise<Uint8Array> {
  if (!response.ok || response.redirected || !response.body) {
    void response.body?.cancel().catch(() => {}); throw new Error("read_unavailable");
  }
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    void response.body.cancel().catch(() => {});
    throw new Error("read_too_large");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0, complete = false;
  try {
    while (true) {
      const chunk = await withGithubAbort(reader.read(), signal);
      if (chunk.done) { complete = true; break; }
      size += chunk.value.byteLength;
      if (budget) {
        if (!Number.isSafeInteger(budget.remainingBytes) || budget.remainingBytes < 0) throw new Error("read_budget_unavailable");
        const available = budget.remainingBytes;
        budget.remainingBytes = Math.max(0, available - chunk.value.byteLength);
        if (chunk.value.byteLength > available) throw new Error("read_budget_exhausted");
      }
      if (size > maxBytes) throw new Error("read_too_large");
      chunks.push(chunk.value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally {
    if (!complete) void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch { /* aborted reads are cancelled above */ }
  }
}
