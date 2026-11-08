/** Synthetic, test-only workspace text policy that satisfies the real
 * pinTextAdmissionPolicy / assertTextAdmissionPolicy checks without weakening them. */
export const TEST_TEXT_MODEL = "anthropic/claude-sonnet-5";
export const testTextPolicy = Object.freeze({ provider: "vercel_gateway" as const, model: TEST_TEXT_MODEL });
export const testTextPolicyRow = Object.freeze({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: TEST_TEXT_MODEL }, fallbackOrder: ["vercel_gateway"] });
/** True when a raw query is the policy re-check issued by assertTextAdmissionPolicy. */
export const isTextPolicyQuery = (sql: unknown) => typeof sql === "string" && sql.includes('FROM "OrganizationAIProviderPolicy"');
