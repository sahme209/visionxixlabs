# ADR: Orchestrator independence and on-prem operation (A9.8)

Status: **proposed** (2026-11-09). This must be accepted before any adapter migration or on-prem deployment (A9.10). Decisions marked *settled* are already fixed by reviewed design or merged code. Decisions marked *needs owner* need an explicit decision.

Sources: `docs/product/orchestrator-contract-design.md`, `lib/orchestrator/contract.ts`, `docs/product/onprem-dependency-inventory.md`, `docs/product/orchestrator-onprem-dependency-inventory.md`.

| # | Topic | Decision | Status | Evidence / open |
|---|---|---|---|---|
| 1 | Tenant, execution and source identity across adapters | Every adapter call is bound to (organizationId, connectionId, engineKind, profileVersion). The server selects the adapter from a registry and never takes a request-supplied module, class or URL. Source identity is an exact revision or digest, never a branch name. | settled | Design §2; `CAPABILITY_PROFILES` are server-owned. |
| 2 | Stable engine, run and event IDs | Axiom stores the engine's own run ID plus a deterministic Axiom start identity, so a lost acknowledgement can be recovered without resubmission. Event identity is engine + run + event ID. | settled | Design §3 `recover`, §4; Airflow scheduled run IDs already deterministic. |
| 3 | Capability and error vocabulary | `axiom.orchestrator/1`: the normalized states and closed error codes in `lib/orchestrator/contract.ts`. Unknown means unknown; unsupported is reported, never simulated. | settled | Contract kernel and tests (C01, C09). |
| 4 | Retry, claim, uncertainty and cancellation ownership | Axiom core owns claims and the one-attempt ledger. Adapters never resubmit, and an uncertain outcome stays consumed-unknown. Cancellation is a separate, separately authorized operation, and a cancel request is not a completed cancel. | settled | Design §3 and §6. |
| 5 | Engine-independent approval and policy authority | Approvals, policy (including the agent gateway kernel) and audit live in Axiom, never in the engine. Engine callbacks and events never authorize anything. | settled | Gateway kernel; design §1. |
| 6 | Source and evidence freshness offline | Evidence carries `observedAt` and `expiresAt`. Offline, it expires on the local clock and is re-observed locally. Stale evidence refuses, never assumes. | proposed | Needs a local time-source decision for air-gapped sites (NTP inside the network). |
| 7 | Audit retention and integrity | The audit log is append-only and sealed with the AuditSeal chain. The customer sets retention, and the latest seal fingerprint is exported outside the deployment. | proposed | Seal chain and anchor export/check merged (`lib/audit/sealAnchorKernel.ts`, `/api/audit/anchor`, Trust tools); retention defaults need owner (suggest 400 days). |
| 8 | Encryption and key custody | Credentials use context-bound AES-GCM envelopes. On-prem, the key-encryption key comes from the customer's KMS or HSM, and Axiom never holds it. | needs owner | Choose supported KMS interfaces (PKCS#11, Vault Transit, cloud KMS when online). |
| 9 | Local SSO and session recovery | OIDC/SAML against the customer IdP, with desktop pairing through the local web app. There is no dependency on visionxixlabs.com for sign-in in offline mode. | needs owner | Today sign-in goes through visionxixlabs.com; an offline auth mode must be designed. |
| 10 | Local-model data boundaries | AI is opt-in per workspace. Offline mode uses customer-hosted models only, and context redaction (A7.16) applies to every AI path. | proposed | Redaction merged; governed customer-hosted design in [2026-11-09-a9-offline-governed-local-models.md](2026-11-09-a9-offline-governed-local-models.md), awaiting review and three owner decisions before code. |
| 11 | Offline license behaviour | Enterprise offline mode works with no licence call-home. Entitlements come from a signed, time-bounded offline licence file. | needs owner | Commercial terms decide grace periods and seat counting. |
| 12 | Reproducible air-gap artifact supply chain | Signed, checksummed bundles (app, engine adapters, migrations, SBOM) built from tagged commits, with Dependabot plus audit upstream. | proposed | Supply-chain checks merged; bundle format and signing key ownership open. |
| 13 | Upgrade and rollback compatibility | Schema migrations stay additive across one minor version. Adapters negotiate the contract major version and refuse unknown ones (C01). Rollback means the previous bundle plus a backup restore, never a reverse migration. | proposed | Matches current additive-migration practice. |

## Custom engine adapter (acceptance item "a documented adapter lets a custom engine integrate")

A custom engine is added in four steps. Nothing is enabled until its contract vectors pass against a real engine.

1. **Profile.** Add an `EngineKind` and a `CapabilityProfile` in `lib/orchestrator/contract.ts`. Mark every operation you have not implemented and reviewed as `unsupported`.
2. **State map.** Map the engine's native run states to the normalized states. Leave anything uncertain unmapped so it stays `unknown`.
3. **Read-only client.** Follow the Prefect, Dagster and Argo clients:
   - accept only an HTTPS base URL, refusing private hosts after DNS resolution;
   - bound every page and reject rows outside the requested scope;
   - put no mutation methods on the client, and pin the method list in a test.
4. **Vectors.** Run the shared vectors C01–C14 from the design. Mocks prove only the schema. Acceptance needs the real engine (A9.7).

Submission (`start`, `cancel`) for any engine is added only after core Governance enforcement (A9.10), behind the existing claim and approval path.
