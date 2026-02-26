#!/usr/bin/env npx ts-node
/**
 * Phase 3 token smoke test.
 * Verifies that verifyStarterToken accepts:
 * - Current format: base64url(leadId).timestamp.signature
 * - Legacy format: base64url(leadId).base64url(hmac)
 *
 * Run: STARTER_TOKEN_SECRET=test npx tsx scripts/token-smoke-test.ts
 */

import { createStarterToken, verifyStarterToken } from "@/lib/starterToken";
import { createHmac } from "crypto";

function createLegacyToken(leadId: string): string {
  const SECRET = process.env.STARTER_TOKEN_SECRET || "";
  const payload = Buffer.from(leadId, "utf8").toString("base64url");
  const hmac = createHmac("sha256", SECRET).update(leadId).digest("base64url");
  return `${payload}.${hmac}`;
}

async function main() {
  const leadId = "smoke-test-lead-123";

  // Test 1: Current format
  const currentToken = createStarterToken(leadId);
  const currentResult = verifyStarterToken(currentToken);
  if ("error" in currentResult) {
    console.error("FAIL: Current format token should validate:", currentResult);
    process.exit(1);
  }
  if (currentResult.leadId !== leadId) {
    console.error("FAIL: Current format leadId mismatch:", currentResult.leadId, "!=", leadId);
    process.exit(1);
  }
  console.log("OK: Current format token validates");

  // Test 2: Legacy format
  const legacyToken = createLegacyToken(leadId);
  const legacyResult = verifyStarterToken(legacyToken);
  if ("error" in legacyResult) {
    console.error("FAIL: Legacy format token should validate:", legacyResult);
    process.exit(1);
  }
  if (legacyResult.leadId !== leadId) {
    console.error("FAIL: Legacy format leadId mismatch:", legacyResult.leadId, "!=", leadId);
    process.exit(1);
  }
  console.log("OK: Legacy format token validates");

  // Test 3: Invalid token
  const invalidResult = verifyStarterToken("invalid.token.here");
  if (!("error" in invalidResult)) {
    console.error("FAIL: Invalid token should return error");
    process.exit(1);
  }
  console.log("OK: Invalid token rejected");

  console.log("All token smoke tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
