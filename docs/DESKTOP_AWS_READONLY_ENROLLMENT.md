# Desktop AWS existing-role enrollment

## Reachable customer path

Settings → Integrations contains the AWS read-only role enrollment panel. The old Connectors and Connector Setup source views are not customer navigation destinations; this implementation does not depend on them becoming reachable. Existing GitHub, Slack, Teams, Linear and integration-health behavior is preserved. Azure and Google Cloud enrollment remain unavailable here.

A verified browser-paired workspace member may read service-recorded AWS accounts with `workspace:read`; starting/completing enrollment additionally requires `connections:manage`. Recovery API keys do not enable this enrollment. These UI checks explain availability, while the service independently enforces pairing, accepted tenant membership and capabilities on every request. Requests use the paired bearer and omit browser cookies.

1. Enter the expected AWS account ID, an existing role ARN in that account, and region. Format checks never establish a connection.
2. Request the service-generated expiring enrollment challenge. The response must match the exact submitted account, role and region.
3. An authorized operator separately reviews/configures the already-approved role trust using the external ID and the reviewed Axiom caller principal. This app neither creates nor changes IAM resources, supplies unreviewed write permissions, or authorizes that operator change. No long-lived provider secret is entered in desktop.
4. Ask the service to verify the existing role. Only a successful HTTP/envelope/validated account result for the expected account and region may update the role-identity display.

The service verifies role identity using AWS STS. **AssumeRole/GetCallerIdentity does not attest that the role's complete IAM permission policy is read-only.** The operator must separately review least privilege. Connected in this slice means successful role-identity validation, not inventory coverage, deployment permission, Terraform execution or a completed governed deployment. A separate on-demand inventory request can read one bounded EC2 page in the enrolled region; it does not enable generic Agent scans. New accounts remain `enabled: false` and `agentScanAvailable: false`.

## Bounded inventory read

A verified recorded account exposes a separate **Read bounded EC2 inventory** action. It calls the paired tenant endpoint for that account ID; the service chooses the enrolled region, and the desktop cannot override it or submit credentials. The result must identify the same AWS account and an enrolled region, declare `source: live` and `complete: false`, and contain at most five sanitized instance records. No tags, raw provider response, secrets or whole-account totals are displayed.

The panel shows observation time and truncation explicitly. An empty page is not proof that the account is empty; a nontruncated page excludes other regions and resource types. Permission denial and service unavailability remain errors with no fixture fallback, while the previously verified role identity remains recorded. Stale inventory after credential replacement/unmount is ignored. This is one bounded read, not complete resource discovery or an AI deployment capability.

## Failure and lifecycle behavior

Missing schema, absent broker configuration, revoked authority and provider verification failures remain errors. HTTP 503 cannot become success just because its body contains a success-shaped envelope. Invalid response shapes never manufacture a connected state. Previously recorded account rows remain visible when replacement verification or refresh fails; their last service validation time is shown, rather than asserting live health.

Form changes, locally dismissed challenges, credential-context changes and unmount invalidate pending responses. An older account-list response cannot overwrite a newly verified account. Challenges are held only in memory, not logged or persisted by desktop. Dismissal is local: a provider verification already started may still finish on the service, so the UI tells the operator to refresh recorded state. It does not claim a server rollback or invalidate a server-issued challenge. Expired challenges require a fresh request.

## Evidence and outstanding customer acceptance

Request-boundary and interaction tests simulate service responses for paired authority, recovery-key denial, exact challenge matching, expiration, schema/config errors, HTTP failures, stale completions, replacement failures and bounded/truncated inventory messaging. Desktop compilation/build and tests are source-level verification only; no production endpoint or AWS account is called by this work.

Real acceptance still requires: recovered website authentication, a signed installed app, accepted paired workspace membership/capabilities, reviewed nonproduction AWS account and existing role/trust, approved broker runtime setup, then real STS validation and read-only inventory evidence. Broker/provider credentials, IAM trust changes, production schema changes, cloud infrastructure changes and execution all require their separate approvals. This panel alone does not close the cloud connection → AI-assisted deployment → approvals → execution → rollback journey.
