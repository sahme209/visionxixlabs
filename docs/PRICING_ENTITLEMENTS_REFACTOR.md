# Pricing & Entitlements Refactor Summary

**Date:** 2025-03-01  
**Goal:** Remove duplicate pricing layers; derive all feature access from Stripe `User.plan` only.

---

## Changes Implemented

### 1. New Single Source of Truth: `lib/entitlements.ts`

- **`getEntitlementsFromPlan(userPlan)`** — Derives all feature access from `User.plan` (starter | growth | scale | enterprise).
- **Plan → entitlement mapping:**
  - `starter` → builder only
  - `growth` → builder + axiom scan (technical outputs, configs, cloud connectors, remediation)
  - `scale` → builder + axiom scan + axiom execution (plugin runs)
  - `enterprise` → full access

- **Exports:** `resolveOperatorTier`, `resolveEffectiveOperatorTier`, `canViewTechnicalOutputs`, `canDownloadConfigs`, `hasContinuousReassessment`, `hasEnterpriseEngagement`, Cloud Studio tier helpers, `stripePriceToUnified`, `resolveUnifiedTierForLead`, `planMeetsMinimum`.

### 2. Deprecated Pricing Modules (Kept for UI Display)

- **`lib/pricing/builder.ts`** — `@deprecated`; display-only for `/builder/pricing`. Entitlements now from `getEntitlementsFromPlan`.
- **`lib/pricing/axiom.ts`** — `@deprecated`; display-only for `/axiom/pricing`.
- **`lib/cloudOperator/pricing.ts`** — Re-exports from `@/lib/entitlements`; deprecated.
- **`lib/cloudStudio/pricing.ts`** — Re-exports from `@/lib/entitlements`; deprecated.
- **`lib/pricing/unifiedTier.ts`** — Re-exports from `@/lib/entitlements`; deprecated.

### 3. Removed `User.modules` Dependence

- **`api/execution/run`** — Uses `getEntitlementsFromPlan(userPlan)`; requires `axiomExecution` (scale+). No longer reads `user.modules`.
- **`api/axiom/execute-fixes`** — Same; checks `axiomExecution` before calling `executeFixes`; passes `userPlan` instead of `userModules`.
- **`api/connectors/link`** — Uses `resolveEffectiveOperatorTier(payload.tier, userPlan)` when lead has `userId`; fetches user plan for entitlement resolution.
- **`lib/execution/pluginEngine.ts`** — Validates via `getEntitlementsFromPlan(userPlan)`; no `hasAxiomModule` or `hasPlugin` checks. Scale+ gets execution access.
- **`lib/execution/engine.ts`** — Accepts `userPlan` instead of `userModules`; uses `getEntitlementsFromPlan` for axiom/builder gating. `skipPlanCheck` replaces `skipModuleCheck`.
- **`lib/axiom/pluginExecution.ts`** — `ExecuteFixOptions` now takes `userPlan` instead of `userModules`.
- **`api/builder/provision-cloud`** — Passes `userPlan` to `execute`; uses `skipPlanCheck`.

### 4. Stripe Webhook

- Webhook already sets `User.plan` for `checkout.session.completed` and `customer.subscription.updated/deleted`.
- Maps price IDs to `starter` | `growth` | `scale` via `STRIPE_PRICES_*` env vars.

---

## Files Modified

| File | Change |
|------|--------|
| `lib/entitlements.ts` | **New** — single entitlements module |
| `lib/cloudOperator/pricing.ts` | Re-exports from entitlements |
| `lib/cloudStudio/pricing.ts` | Re-exports from entitlements |
| `lib/pricing/unifiedTier.ts` | Re-exports from entitlements |
| `lib/pricing/builder.ts` | Deprecation comment added |
| `lib/pricing/axiom.ts` | Deprecation comment added |
| `app/api/execution/run/route.ts` | Plan-based entitlements |
| `app/api/axiom/execute-fixes/route.ts` | Plan-based entitlements |
| `app/api/connectors/link/route.ts` | Uses `resolveEffectiveOperatorTier`, fetches user plan |
| `app/api/builder/provision-cloud/route.ts` | Passes `userPlan`, uses `skipPlanCheck` |
| `lib/execution/pluginEngine.ts` | Plan-only validation |
| `lib/execution/engine.ts` | Plan-based permissions |
| `lib/axiom/pluginExecution.ts` | `userPlan` instead of `userModules` |

---

## No Changes (Per Requirements)

- UI components (pricing pages, dashboard) — not modified
- New features — none added
- `lib/pricing/membership.ts` — remains canonical for plan metadata; `getEntitlementsFromPlan` uses it

---

## Migration Notes

- `User.modules` is no longer used for execution or connector gating. It may be removed in a future schema migration.
- All existing callers of `cloudOperator/pricing` and `cloudStudio/pricing` continue to work via re-exports.
- New code should import from `@/lib/entitlements` directly.
