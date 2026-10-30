# One separately reviewed corrective evidence-note attempt

## Why this is a new boundary
Original b38 version8 and fresh7292 version3 are both consumed/refused/attempt1, definitely unwritten in durable records. Their history must never be reset, extended, re-approved or replayed. The existing fresh-attempt design permits one child only and must continue to reject ordinary retry chains. Local repair2c03f28f addresses a reproducible pre-write timing fragility; its live outcome remains unverified.

## Proposed local-only addition
Allow one explicitly named corrective generation for this exact native-preflight repair revision, after verifying both the original and its sole child as immutable refused/unwritten provider-mode attempts owned by the same requester/executor. Unknown/dispatching/possibly-written records are ineligible. Require current administrator authority, current independently approved association, native access, and a fresh narrow exact-note absence proof.

Create a new deterministic plan ID bound to the original ID/version/candidate digest, refused child ID/version/candidate digest, fixed server repair revision `servicenow-native-link-preflight-v1`, and the unchanged logical note. The repair revision is a server constant, never client-controlled. A candidate with a corrective generation cannot itself be a recovery parent. An existing corrective plan prevents creation of another, regardless of request nonce or expired review.

The exact original target, payload digest, logical marker and deployment evidence must match. Original and child histories are rechecked under locks during prepare, independent approval and the one claim. The UI must display both consumed ancestors and the repair revision. The new plan requires its own genuine independent human approval plus exact requester execution authorization. No approval/attempt/deadline is inherited. It gets one normal attempt with unchanged expiry, lease and provider/native checks. Failure or uncertainty stops further recovery.

The local approval requested here covers implementation/tests only, not deployment or a provider write. Proposed tests include every ancestor status/write/actor/version/digest mismatch; missing or present/unknown journal proof; cross-association/target/payload changes; duplicate and concurrent preparation; arbitrary revision; expired review; missing independent approval; and prohibition of further corrective descendants.

Batch the completed repair and recovery implementation for one later activation review to conserve Vercel build usage. After that activation, live execution still needs the new exact plan's independent review and separate one-note authorization. ServiceNow's native change approval lifecycle and closure remain untouched.
