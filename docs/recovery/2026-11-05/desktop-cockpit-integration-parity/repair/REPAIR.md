# Local cockpit discovery repair

Added Outlook and ServiceNow to authenticated cockpit Integrations, linking only existing guarded /account/integrations/outlook and /account/integrations/servicenow. Admins can open settings; viewers see provider purpose without new setup controls. No health badge/status is invented; Outlook copy explicitly says current status is not shown here and settings manage sign-in; ServiceNow points to its existing settings status check. Exact action/native lifecycle approvals remain. Both new links set prefetch=false, preventing implicit setup-page reads. Existing auth/membership/provider-status queries and connection handlers are unchanged. Admin settings navigation remains available when unrelated aggregate records fail, with existing unavailable banner; the destination independently checks current access. No current identity is fabricated or passed as a desktop credential.

Finite actual rendered DOM tests use mocked auth/DB/components and semantic Link capture. Initial intended3missing-entry failures/2controls became5passes; the explicit no-prefetch contract then failed1/4passes before source correction and final5passes. The first runner invocation stopped at unsupported --minWorkers before any test; its raw error is retained, followed by the corrected bounded thread runner. Vite's existing configLoader/CommonJS warning remains in output. No full build, browser/AT walkthrough, live provider/DB/page visit, OAuth action, new scope/permission, deployment or production acceptance is claimed.

Command: ./node_modules/.bin/vitest run app/control/integrations/__tests__/presentation.test.ts --maxWorkers=1 --pool=threads

Source hashes identify this local candidate. Independent read-only review is requested separately; no passing suites need repetition unless review finds a meaningful new concern.

Independent review found that the Outlook setup page does not read current connection status; its first wording overpromised that check. The local copy now explicitly says status is not shown here and settings manage sign-in. No reader/auth behavior was added. A focused rendered contract failed1 before the correction then passed1; four unchanged cases were skipped rather than repeated. The earlier5-case pass remains bounded to its preceding source. Final source hashes include this wording correction.

Final independent read-only review confirmed the corrected wording and found no important remaining issues. No tests, network, browser, provider or build operation was repeated by the reviewer.
