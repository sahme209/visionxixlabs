# Approved desktop Agent model selection — source acceptance

This extends the existing Settings policy and durable admission implementation;
it does not enable a new provider, change a price, or release a desktop installer.

The common chat and repository-editing composer uses a searchable, keyboard-native
selector grouped by actual model vendor. Choices are the intersection of the
service catalog and current workspace approvals. Legacy policy offers its exact
default only. Managed defaults omit an explicit model rather than inventing a
concrete choice. Settings remains the administrator's policy boundary.

Only a non-secret choice is saved locally, scoped by service address and verified
organization identity. Invalid or inaccessible storage is optional. Every refresh
revalidates the choice; unavailable models are removed with a visible notice.
Loading and failed catalog reads disable new messages. The existing fourth
workspace-context argument is preserved; a concrete Gateway choice uses an
optional fifth argument. Both chat and repository-file submissions exercise this
path in rendered component tests.

The server validates explicit preference shape before persisting a user turn.
Every extraction and repair rechecks service configuration, current workspace
policy and the service-filtered model catalog before durable credit admission.
Dispatch catalog reads bypass the UI's cache. A policy refusal ends the loop
without being interpreted as malformed model output that deserves a paid repair.
The original actor, tenant, output bound, retry limit, usage attribution, tool
permissions and consequential-action approval gates remain in force.

Root independently ran four desktop suites: **31 tests passed**, including actual
rendered chat/code dispatch, approved choice filtering and local preference scope.
This is application-component and inert transport acceptance, not an actual
provider call, packaged native interaction, streaming result or customer charge.
The actual desktop client transport's 33-case suite also passed, including two
new checks that preserve the fourth workspace-context argument and serialize or
omit the optional model in the real request body. Root independently passed 62
backend resolver/catalog/handler checks; the backend author passed 118 focused
cases. Desktop frontend type/build, source lint and 15 walkthrough contract
checks passed. The Python CLI's 30 existing checks passed. Combined exact-head
CI is still required; no provider or native runtime was invoked by these checks.

## Existing open gates

- PR184's exact-head browser run 39463927943 failed the documentation-navigation
  deadline after eleven completed checks. No documentation request reached the
  fixture. Root cause remains unconfirmed; no retry or acceptance waiver is made.
  Receipt: `public-website-browser-blocker-3f6e4c56.json`.
  That head's full CI 39463927956 passed types, all unit tests, offline auth
  evidence and the production website build without deployment. It is not a
  receipt for later model-selection changes or a waiver of the failed browser.
- Actual PostgreSQL claim concurrency, native desktop, hosted Stripe TEST journey
  and real-provider cost coverage remain unverified. The unchanged 1000-cent hold
  exceeds the new TEST Free allowance; no pricing adjustment hides this refusal.
- Streaming and real multi-agent tool workflows are separate unfinished mission
  requirements. A working selector does not establish either.
- Direct Mac header download must point to an approved verified release asset.
  It cannot justify publishing an installer or fabricating release availability.
- Production database recovery, secrets, billing activation, desktop release and
  final Vercel deployment retain their separate owner approval gates.
