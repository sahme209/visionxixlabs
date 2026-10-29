# Synthetic release acceptance fixture

Local preparation only. Nothing here has been published or executed.

This fixture must be placed in a separately approved, newly created test repository, never copied over an existing repository or mixed with Axiom source/history. It contains no customer data, credentials or production configuration.

The intended journey is an independently reviewed change to index.html, a single governed merge, a separately reviewed deployment plan, one manual workflow dispatch against an exact protected lightweight tag, and verification of the exact first workflow run. The prepared workflow has only a manual workflow_dispatch trigger; publication and any run remain separately gated. Copy this fixture directory as the future repository root, not as a subfolder.

Required external gates: explicit repository/publication approval; verified repository policy; GitHub App permissions; genuine second-person approvals; exact merge and dispatch authorization. Unsupported source guarantees fail closed. A successful workflow alone does not prove application deployment or health.

Prepared workflow: .github/workflows/deploy.yml. Official action commits were resolved read-only from GitHub on October28,2026 and pinned by full SHA. Standard ubuntu-24.04 runner only, five-minute job bound, no automatic retry or scheduled/push/PR triggers. Repository Pages/environment settings, installation permissions, exact policies, final public file review and actual provider usage must be verified and approved before any publication/dispatch. Axiom source and credentials must never enter this fixture.

The workflow requests contents:read, pages:write and id-token:write only for this synthetic repository. It deploys index.html and a fixture-marked health.json containing source commit, marker and content digest; workflow success alone is still not delivered-content acceptance. Verify the actual public result against these values separately.
