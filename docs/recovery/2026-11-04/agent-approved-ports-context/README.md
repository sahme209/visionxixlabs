# Saved Agent action ports — local render-context repair

Actual AgentChatView plus real AgentApprovedActions rendered tests reproduced all five stale-context outbound calls: outcome, readiness, prepare, execute and cancel. Five same-context controls passed. Three root port entry checks now compare the rendered transport context to the live client before dispatch. Stale mutation returns nonsent/false uncertainty only in that proven zero-client-call branch; no in-flight result is caught, rewritten or retried. Existing child hold, exact readiness/saved-ID, approval, claim, expiry and transport uncertainty behavior is unchanged.

Final10rendered cases pass, including exact same-context prepare/execute/cancel arguments; desktop source noEmit and independent read-only review pass. All credentials/provider/approval states are synthetic mocked fixtures; no genuine human decision or provider mutation occurred. This is a client intent/ownership repair, not proof of a server authorization bypass or full account/native/Governance acceptance.

Current475signed app remains open unchanged; repair is unshipped. Main Agent whole-file source-binding baseline now needs explicit current-Git requalification; original control IDs/nodes/purposes were not modified. No new deployment, CI, AI, DB, credential/grant or service action. All21parent requirements remain open.
