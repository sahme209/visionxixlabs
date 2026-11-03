# Execution limits preview

Help ID: `governance.execution-limits`

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

The [control inventory](governance-execution-limits-controls.json) assigns stable help IDs to each visible control and records its source, request effect and capability. These are documentation identifiers; they are not installed UI anchors or a retrieval service.
