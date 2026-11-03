# Native baseline-scoped execution limits entry — local progress

2026-11-02. Local frontend implementation within the user-approved execution-policy/native workflow design. No new server authority, API, provider permission, baseline enrollment, production activation, native installer or live acceptance.

## Concrete customer-workflow gap closed locally

Settings previously exposed only the deliberately read-only Governance evidence preview. It passed no authoring identity, so the already implemented execution-limit proposal/reviewer panel had no reachable native entry. Passing a generic identity would also have exposed source discovery, collection and baseline authoring. The new DEV-only **Execution limits preview** entry instead passes a separate narrow execution-policy identity and mounts the existing limits panel only after a deliberate exact saved-baseline read.

Existing **Inspect saved Governance** remains read-only. Production Settings exposes neither local entry. The limits lane uses its own heading and “Load an exact saved baseline, then load or propose limits” next step; generic source-evidence journey, saved source/fact browsing, source collection, provider revalidation, baseline proposal/review and enrollment controls are absent. Loaded baseline/rules disclosures and the existing limits controls remain.

- Baseline ID and organization must match the requested revision and captured paired workspace. Baseline selection alone does not approve or rewrite anything.
- Panel scopes come only from that loaded baseline. Exact saved policies outside those scopes refuse presentation; comparison uses repositoryId/resourceId/environment fields, independent of object insertion order. Remount keys use explicit scope tuples.
- Baseline ID/digest, captured verified identity and actual client-context revision/config control ownership. Changing baseline or client/session identity clears policy/review state; late asynchronous baseline/policy responses after same-user session replacement are discarded. Starting a same-baseline reload immediately unmounts old decision controls.
- Generic authoring identity plus narrow limits identity is ambiguous and refuses both lanes before child mounting.
- Current capability names affect presentation only. The unchanged paired server still checks session, membership, current source/policy, expiry, independent reviewer, named executors, original request and CAS. There is no UI-issued authority or automatically inferred approval. Limits are ceilings, not provider permission or executor coverage.
- Mounting causes no read or mutation. All saved-record reads, member/parent lookup, proposal and independent review remain deliberate existing actions. Original unknown outcomes are not automatically resent.

Runtime files: `desktop/src/views/SettingsView.tsx`, `GovernanceWorkspacePreview.tsx`, `GovernanceEvidenceView.tsx`, and `desktop/src/components/GovernanceExecutionPolicyPanel.tsx`. Directly relevant regression: `lib/desktop/__tests__/governanceExecutionLimitsEntry.test.ts`.

## Genuine evidence and fixture limits

All new mounted journeys use actual React Settings → narrow lane → saved baseline → existing proposal/reviewer components. Authentication identity, baseline/member/policy API responses and mutations are **SIMULATED presentation fixtures**; they do not prove real human approval, server/store admission, live provider state or native-host interaction. No PostgreSQL journey was needed for this frontend-only mounting increment.

- Initial actual-mounted RED `/private/tmp/axiom-native-limits-entry-red.log`: **6 failed / 1 passing production-hiding control**, before wiring.
- Same-baseline reload RED `/private/tmp/axiom-native-limits-entry-reload-red.log`: old review controls remained during reload; they are now unmounted immediately.
- Semantic scope/ambiguous-props RED `/private/tmp/axiom-native-limits-entry-scope-red.log`: **2 failed**, then explicit field scope comparison and ambiguous-lane refusal.
- Narrow-heading/journey RED `/private/tmp/axiom-native-limits-entry-lane-red.log`: limits lane still showed generic evidence heading/next step; corrected only that lane.
- Final `/private/tmp/axiom-native-limits-entry-green.log`: **41 passed across 5 focused suites**, actual exit0. Includes 16 mounted-entry checks plus existing affected evidence/preview/policy/proposal regressions. Covers deliberate proposer, independent reviewer, read-only role, exact baseline tenant/scope, semantic key order, lost baseline/session, late same-user replacement, original read-only lane, ambiguous props and production hiding. No unchanged broad suite was run.
- Scoped frontend + new-test TypeScript `/private/tmp/axiom-native-limits-entry-types.log`: **exit0, empty output**, using `work/native-limits-entry/tsconfig.json` and Node24.21.0. A test-only React createElement optional-props typing error was corrected; no runtime type check was weakened.

- Desktop frontend `npm run build` (existing release check → full desktop TypeScript → Vite): **actual exit0**, `/private/tmp/axiom-native-limits-entry-frontend-build.log`. One build under Node24.21.0; no root Next build, native compilation, app launch or installer. Vite retained the existing mixed static/dynamic Tauri import and >500kB chunk warnings; these are not claimed fixed. Production build does not make the DEV-only lane a shipped customer capability.

A diagnostic using fireEvent to change disabled baseline/policy inputs was discarded: it does not model an available native user interaction. No selection-race defect or epoch fix is claimed from that artificial diagnostic. Final mounted tests instead verify that inputs and selection-changing controls are disabled during pending reads. Actual context/session replacement remains independently tested.

Independent source security review and final targeted JSX review reported **no material findings**; root separately reviewed scope, lane isolation and usability. This receipt does not upgrade simulated API tests to authority or physical UI acceptance.

## Remaining gates

Server flags remain default OFF; production coverage remains empty and baseline activation refuses. This task does not change execution-policy/backend stores, credentials, Governance admission, source freshness, grants or feature flags. Existing execution-limit activation is distinct from baseline enrollment and does not authorize provider actions.

Unrecorded pending-request recovery across unmount/restart remains incomplete; recorded original-session decision lookup is not proof of an unrecorded outcome, and unknown requests must not be resubmitted automatically. Native signed-package journeys, genuine independent human decisions, comprehensive executor adoption, source-qualified issuer/runtime/legacy proof, credential/effect drain and separately authorized live acceptance remain required. No completed Governance MVP or shipped version claim.
