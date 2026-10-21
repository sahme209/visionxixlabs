/** Keep cancellation checks compatible with WKWebView versions that expose
 * AbortController but lack AbortSignal.throwIfAborted and AbortSignal.reason.
 * This does not polyfill or change the signal, cancellation timing or authority. */
export function assertDesktopNotAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  throw reason === undefined ? new DOMException("The request was canceled.", "AbortError") : reason;
}
