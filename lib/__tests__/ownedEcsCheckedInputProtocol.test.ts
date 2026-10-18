import { createHash, createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { ECS_WIRE, verifyOwnedSigV4 } from "../../scripts/fixtures/ownedEcsCheckedInputWire.mjs";
function signed() {
  const headers: Record<string, string> = { host: "ecs.us-east-1.amazonaws.com", "x-amz-date": "20261018T120000Z", "x-amz-security-token": "owned-session" };
  const body = '{"cluster":"owned"}', names = "host;x-amz-date;x-amz-security-token";
  const hash = (value: string) => createHash("sha256").update(value).digest("hex"), hmac = (key: string | Buffer, value: string) => createHmac("sha256", key).update(value).digest();
  const canonical = ["POST", "/", "", "host:ecs.us-east-1.amazonaws.com\nx-amz-date:20261018T120000Z\nx-amz-security-token:owned-session\n", names, hash(body)].join("\n");
  const key = hmac(hmac(hmac(hmac("AWS4" + ECS_WIRE.secret, "20261018"), "us-east-1"), "ecs"), "aws4_request");
  const signature = hmac(key, `AWS4-HMAC-SHA256\n20261018T120000Z\n20261018/us-east-1/ecs/aws4_request\n${hash(canonical)}`).toString("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=ASIAOWNED0001/20261018/us-east-1/ecs/aws4_request, SignedHeaders=${names}, Signature=${signature}`;
  return { method: "POST", path: "/", headers, body };
}
it("checks an owned request HMAC without constructing an SDK, server or network request", () => expect(() => verifyOwnedSigV4(signed(), "ASIAOWNED0001", "owned-session")).not.toThrow());
it.each(["body", "host", "credential", "token", "method", "path", "signature", "duplicate_signed_header"])("rejects owned protocol %s tampering without IO", mode => {
  const request = signed();
  if (mode === "body") request.body += " ";
  if (mode === "host") request.headers.host = "other.invalid";
  if (mode === "credential") request.headers.authorization = request.headers.authorization.replace("ASIAOWNED0001", "AMBIENTKEY");
  if (mode === "token") request.headers["x-amz-security-token"] = "other-token";
  if (mode === "method") request.method = "GET";
  if (mode === "path") request.path = "/other";
  if (mode === "signature") request.headers.authorization = request.headers.authorization.slice(0, -1) + (request.headers.authorization.endsWith("a") ? "b" : "a");
  if (mode === "duplicate_signed_header") request.headers.authorization = request.headers.authorization.replace("host;x-amz-date", "host;host;x-amz-date");
  expect(() => verifyOwnedSigV4(request, "ASIAOWNED0001", "owned-session")).toThrow();
});
