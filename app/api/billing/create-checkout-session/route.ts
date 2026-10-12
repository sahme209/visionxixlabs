// Compatibility alias. Keeping one implementation prevents the former
// lead-level checkout path from creating a user subscription that disagrees
// with organization billing and entitlements.
export { dynamic, POST } from "../checkout-session/route";
