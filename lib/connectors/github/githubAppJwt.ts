import { createSign } from "node:crypto";
const JWT_TTL_SEC = 9 * 60;
interface JwtClaims {
  iat: number;
  exp: number;
  iss: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signJwt(appId: number, privateKey: string, now: () => number = Date.now): string {
  const timestamp = Math.floor(now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims: JwtClaims = {
    iat: timestamp - 30,           // 30s clock-skew tolerance backward.
    exp: timestamp + JWT_TTL_SEC,
    iss: appId,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

