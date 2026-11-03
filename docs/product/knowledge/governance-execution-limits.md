# Execution limits preview

Help ID: `governance.execution-limits`

**Internal source-reviewed draft; customer-ineligible and unpublished.** Reconciled against local source `91d3f88d` on November 3, 2026. This version has no current native screenshots, production release binding, or complete native end-to-end qualification. The existing guide already covers the workflow; this reconciliation does not create a second guide or new authority.

This development-only desktop preview lets you inspect, propose, independently review, activate and revoke numeric execution ceilings. An active ceiling is only a maximum eligible level. It does not approve a provider action, supply provider access, enroll a baseline or prove execution coverage. This article describes the current local implementation, not a production-supported Governance MVP.

## Start with an exact saved baseline

In a development desktop build, open Settings → **Review execution limits preview**. Opening the lane sends no server reads. Use **Load saved baselines**, select or enter a saved baseline revision ID, then choose **Load baseline review**. The response must match that ID and organization. Its saved repository/resource/environment scopes provide the offered limit scopes; loading it does not approve or enroll it.

Changing the baseline or paired context clears the prior controls. Pending requests disable edits, and responses from a replaced context are discarded. **Back to Settings** only navigates locally. The separate **Inspect saved Governance** lane is not this management workflow.

## Propose a ceiling

A current manager with `policy:manage` can choose the exact scope, explicitly load current members and select named executors. Only accepted owner, administrator and operator records are offered; the server still checks their actual action rights. Named executors cannot independently approve this proposal.

Choose a maximum numeric level (0–5) and exact eligible actions. Level 0 allows eligible observations; level 1 adds recommendations. Mutations require at least level 4 and the independent action and platform checks. Choosing an action in this list does not mean its integration, coverage or permission is available.

Enter **Limit expiry** in local time and check the displayed UTC instant. Read the **exact current limit parent**, review the draft and confirm its review checkbox, then **Save limits for independent review**. This saves a proposal only. Editing the draft clears its review confirmation; changing scope also clears the read parent.

## Review, activate or revoke

**Load saved limit policies** lists at most 20 recent records. Select an ID or enter an exact ID, then **Load exact policy**. Lists and receipts are bounded historical views, not proof of complete history or current authority. **Exact policy identifiers** discloses its ID, digest and parent.

A current `agent:approve` reviewer can **Record independent limit approval** for an unexpired proposed revision after reviewing the exact scope, ceiling, executors and expiry. The reviewer must be neither the requester nor a named executor. Current owner, admin and security-reviewer role mappings can provide this capability; a role label or checkbox alone grants nothing.

A current `policy:manage` manager can **Read current limit pointer** and **Activate these limits** for an approved, unexpired policy only when its parent still matches. A changed pointer requires reloading rather than forcing activation. Activation changes the numeric ceiling, not baseline enrollment or execution permission. Saving, reviewing and activating are separate operations.

**Revoke this limit policy** targets the exact loaded nonrevoked revision and expected version. Current management authority is required. Expiry does not prevent containment revocation. Expired records remain historical: approval and activation refuse them, and neither lookup nor reload renews a deadline.

## If a result is uncertain, do not resend

Before a mutation is sent, the desktop writes a bounded, inert locator keyed by service origin, organization, user and original nonce. It contains the original operation and safe identifiers, not the proposal payload, credentials or authority. Failure to persist it prevents the mutation.

For the current in-memory request, **Check original proposal outcome** or **Check original saved outcome** looks up that unchanged original request and verifies its exact expected result. After restart, **Observe original request history** uses the persisted locator for a historical-only lookup. The original actor/session restrictions still apply; a replacement session may be refused. A missing or unavailable result keeps the blocker. Do not resend, generate a replacement nonce, or delete the locator to bypass uncertainty.

A verified historical result clears only that exact local locator. It never restores a draft, approval or current authority; load the policy separately. **Load my recorded decisions**, **Original request locator** and **Select policy from this receipt** help locate records without sending them again. Sparse restart observation reports `exactProposalContentVerified:false` because the original full proposal was deliberately not persisted.

Unresolved requests block new proposals, approvals and activations. A current authorized manager may still revoke a separately loaded exact policy unless an unresolved revoke already names that policy. Corrupt, overflowing or unavailable recovery storage blocks mutations rather than discarding history.

## Access and request effects

Reads require a current accepted workspace member with `workspace:read`. Proposing, activating and revoking require `policy:manage`; independent review requires `agent:approve`. Server checks include the current paired session, capabilities, original participants, expiry and expected state. The backend service must also be enabled. The UI does not grant these capabilities.

Policy reads and decisions use POST requests to the existing execution-policy endpoint. POST lookup/list/read operations are read-only; propose/approve/activate/revoke persist policy state. None of these controls sends a provider action or collects new source evidence. No automatic server reads occur merely on opening this lane.

The [control inventory](governance-execution-limits-controls.json) assigns stable help IDs to each visible control and records its source, request effect and capability. All33 inventoried controls currently have matching literal `data-help-id` attributes in their declared source components. Those source bindings are not a customer retrieval service, approved article ingestion, or evidence of native visual acceptance.


## Source registration and request binding

`SettingsView.tsx:163,241–242` registers this lane only under `import.meta.env.DEV`; the actual preview renders `GovernanceEvidenceView`, which mounts the policy panel only for the current paired desktop identity/capabilities and matching organization/baseline scope. This is a registered **development preview**, not an unmounted example and not a production-shipped feature. The numeric policy panel is not baseline enrollment or provider-action approval.

The actual route `app/api/desktop/governance-intelligence/execution-policy/route.ts` exposes POST and gates the composed HTTP/service on `AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED === 'true'`. `executionPolicyHttp.ts` separates read/lookup/read_active/list_saved/list_requests from propose/approve/activate/revoke; it requires accepted paired desktop membership, refuses API-key authority, checks each required capability and bounds JSON input/output. `executionPolicyRequestService.ts:17–69` binds service operations and lookups to the actual organization, actor and original paired session, with current membership/session checks. A client context or help identifier supplies no permission.

Proposal limits are schema bounds, not autonomy grants: level0–5,1–12 distinct action kinds,1–100 distinct named executors and a canonical UTC expiry (`desktop/src/lib/governanceExecutionPolicy.ts:4–14`). Version/digest/parent checks and current authority still apply. No automatic collection/provider write occurs from a numeric ceiling being active.

The following exact SHA-256 values pin this source-only reconciliation. Later source changes require re-review; this table does not certify a release or runtime.

| Inspected source | SHA-256 |
|---|---|
| `desktop/src/views/SettingsView.tsx` | `48479b6095a876be77e4c8e69794f16baf166cd127716d3373b5d9fabfd9a029` |
| `desktop/src/views/GovernanceEvidenceView.tsx` | `d154a29c5cb47dfa7786a14bd420d8f20205f27d2e3f8af14b42d7cb3c8ffb9c` |
| `desktop/src/components/GovernanceExecutionPolicyProposal.tsx` | `568a74d4cefb98268745a7fa8b495abb00213954ce91ed81c0e9eb2c9483dde4` |
| `desktop/src/components/GovernanceExecutionPolicyPanel.tsx` | `db586c750e00a46d2551f89f41558fa7e90b3e00e32c54257f9acf87d51e1a4e` |
| `desktop/src/lib/governanceExecutionPolicy.ts` | `3da2dbcf268977d84998d283435dad9413e0424c3a8ce127ae32cc8ca00cee91` |
| `desktop/src/lib/useExecutionPolicyRecovery.ts` | `6342c60c7ea21b89aa0f4714b63975ae02d7d1b2139986bff3277762018298aa` |
| `desktop/src/lib/executionPolicyRecoveryStore.ts` | `e51b4c81fa3599a765592d43ca6ce0c9e29ae22b28a90d744aa2a5591bfc310e` |
| `app/api/desktop/governance-intelligence/execution-policy/route.ts` | `dbc25e40d175df6bc1782ef9d0834c1d9ef07ce80a0ad3f146bf51d41916216b` |
| `lib/governance/intelligence/executionPolicyHttp.ts` | `09ff9bbed6041a112f9481f50cb1f1b3fcd894cd04019ee72e61d16d6c430212` |
| `lib/governance/intelligence/executionPolicyRequestService.ts` | `2cb82e97a69336a1974ecb8ce841adf1bd4f3b786eeef8dbbbe20b0fb7114d46` |
