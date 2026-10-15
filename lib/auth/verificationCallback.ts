/** Navigation context only. Never establishes identity, pairing or entitlement. */
export function verificationDesktopCallback(value: unknown, expectedChallenge?: string): string | null {
  if (typeof value !== "string" || value.length > 1024 || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20\x7f]/.test(value)) return null;
  if (value.split(/[?#]/, 1)[0] !== "/desktop/connect") return null;
  try {
    const url = new URL(value, "https://desktop-auth.invalid");
    if (url.origin !== "https://desktop-auth.invalid" || url.pathname !== "/desktop/connect" || url.hash) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.some((key) => key !== "challenge" && key !== "intent") || url.searchParams.getAll("challenge").length !== 1 || url.searchParams.getAll("intent").length > 1) return null;
    const challenge = url.searchParams.get("challenge") ?? "";
    const intent = url.searchParams.get("intent");
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(challenge) || (expectedChallenge !== undefined && challenge !== expectedChallenge)) return null;
    if (intent !== null && intent !== "sign_in" && intent !== "sign_up") return null;
    const params = new URLSearchParams({ challenge });
    if (intent) params.set("intent", intent);
    return `/desktop/connect?${params}`;
  } catch { return null; }
}
