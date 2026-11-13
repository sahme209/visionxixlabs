// Test-only adapter; preserve prototype-backed Request fields and original possession/cancellation.
// This changes no production authentication or default runtime supplier.
export function syntheticRequestContext(request:{headers:Headers;signal?:AbortSignal},fallback:AbortSignal){return {headers:request.headers,signal:request.signal??fallback}}
