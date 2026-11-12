#!/usr/bin/env node
/** Retired administrative entrypoint. Historical implementation is preserved in
 * Git history. Do not restore ambient secrets, implicit environment expansion,
 * upsert or automatic redeployment here. The managed create-only settings flow
 * requires exact independent review, requester execution and qualified custody;
 * its source preparation is not production enablement. Updates remain held. */
console.error('Axiom managed settings review is required. This legacy setup script is retired; no settings or deployment were changed.');
process.exit(1);
