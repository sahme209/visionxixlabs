# Bounded ticket failure diagnostics — local verified batch

The live KAN-4 deployment link is confirmed. KAN-4 closure and CHG0030002 note were independently approved, but each requester dispatch was refused without a committed durable attempt. Exact live cause is unconfirmed; no automatic resends are permitted. All old review windows have now expired.

The confirmed reporting defect is fixed locally: failures before a durable claim may start return existing HTTP409; ambiguous claim/commit failures remain HTTP502. A trusted server-only callback records the conservative uncertainty boundary.

The same narrow batch adds existing-console diagnostics with only fixed phase/reason values, a claim-may-have-started boolean, and elapsed milliseconds capped at300000. No exception text, SQL, IDs, URLs, credentials, token data, provider body or request payload is logged. Known transaction failures, timeouts, credential/readiness failures and source changes receive bounded reasons; other causes remain unknown. Read-only service refusals can also be traced, reducing the need for another provider write attempt.

Two new diagnostics regressions demonstrated RED before implementation. Final19 HTTP/service checks pass; scoped runtime/test types pass; exact production-based candidate build passes, including its production TypeScript phase. Independent review reports no important or critical findings. Production candidate /private/tmp/axiom-ticket-diagnostic-candidate-20261030 is based on the previously source-verified95ef upload plus exactly two runtime and two test files. No schema, settings, scopes, permissions, provider actions, retry limits or deadlines change.

Read-only Vercel timing query returned payment_required for Observability Plus. No paid add-on was purchased or enabled. Diagnostic activation is not yet authorized under the deployment freeze. This batch does not claim the underlying live refusal is fixed.
