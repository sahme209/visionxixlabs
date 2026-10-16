# Isolated real HTTP authentication acceptance

Evidence: 2026-10-15 (America/New_York), application/harness commit `f7de88f0c0d5cffe0d15234534453c4068e41d9c`.
This is a local application-route/session, desktop-protocol and approval-decision milestone, not production recovery or browser/native acceptance.

## What ran

`scripts/rehearse-local-auth-http.mjs` started the actual source Next.js development server with webpack and called actual HTTP routes. A new disposable PostgreSQL 17 container held synthetic data only. The installed Resend SDK used its existing `RESEND_BASE_URL` override to POST to an in-process loopback mail capture; no fetch/Prisma/auth callbacks were mocked. The client retained actual NextAuth CSRF/session cookies and asserted the resulting session and accepted personal workspace record.

The successful run verified:

1. Actual desktop-origin challenge and account signup requiring email proof.
2. Actual SDK verification-mail capture with preserved sanitized desktop callback.
3. Password rejection before email proof, with no authenticated session.
4. Expired proof rejection (expiry changed only in the synthetic fixture).
5. Existing resend endpoint replacing unused proof and sending another locally captured message.
6. Single-use verification and callback preservation; replay denied.
7. Incorrect password denied after verification; correct password accepted through actual CSRF/credentials transport and session cookie.
8. Exactly one accepted owner membership in the synthetic customer's derived personal workspace, a hashed password, and no tenant billing plan created.

The same committed-source run additionally verified ten actual desktop protocol assertions: authenticated consent metadata, device-bound pending poll, wrong-device and unbound-poll denial, browser-session approval, cookie-free one-time consumption, replay denial, paired identity/current membership, owner listing and revocation invalidating the bearer. These are HTTP protocol results, not packaged native/browser/vault acceptance.

Four approval assertions passed against PostgreSQL: foreign-origin refusal, competing form decisions yielding one 303 and one 409, persisted authenticated actor/time, and terminal decision retention. This does not establish provider execution, saved Terraform plan authority or deterministic simultaneous database snapshots.

The desktop commercial-access response reported `allowed: true` with `billingStatus: no_plan`, matching the existing identity-only policy. This is an explicit policy observation, **not verified paid-entitlement enforcement**; no billing plan was created and no policy was changed.

Sanitized result: [local auth HTTP report](mission/local-auth-http-acceptance.json).
Separate safety regressions cover target validation, credential/environment isolation and dotenv refusal. They complement, rather than substitute for, the real HTTP run.

## Isolation and rerun contract

Use a fresh local PostgreSQL container from the already cached `postgres:17-alpine` image with `--pull=never`, a unique database named `axiom_auth_http_` followed by twelve lowercase hex characters, and a port published only on `127.0.0.1`. Wait for `pg_isready -h 127.0.0.1` inside the container: the initialization-only Unix socket server is not proof that published TCP is ready. Supply only that synthetic connection through `AUTH_HTTP_TEST_DATABASE_URL` when invoking:

```sh
node scripts/rehearse-local-auth-http.mjs
```

The harness refuses absent input, hostnames other than literal `127.0.0.1`, missing ports, other database names, URL queries/fragments, populated user schemas and existing development-server locks. It never resets a database and has no `DATABASE_URL` fallback. Runtime `.env*` files are refused; only the checked-in, never-loaded `.env.example` template is allowed. The entire versioned checkout must match its recorded commit; all nonignored untracked files are refused. This includes imported runtime helpers, components, schemas, every package lock/config and the harness itself, rather than an auth-only source list. Commit before running; the same clean commit is checked again before reporting success.

A strict child-environment allowlist retains necessary OS/proxy/CA settings while excluding inherited application/provider credentials and `NODE_OPTIONS`. Database/auth/base URLs, synthetic auth/mail keys and mail destination are explicitly local fixture values. Telemetry is disabled. Mail accepts only the fixed synthetic `example.test` recipient and fixture token; the HTTP client refuses nonlocal origins and never follows redirects automatically. No page/browser resources, OAuth, AI, cloud or billing operations are invoked.

Current-schema `prisma db push --skip-generate` runs only after the empty-target guard. **It does not replay migration history or prove the proposed production repair.** Existing auth-recovery migration rehearsals remain separate.

HTTP requests and the overall journey are bounded (90 seconds per request, four minutes overall). The harness shuts down its owned application process group and mail listener in `finally`. The fixture owner must remove only its new container afterward; all actual fixture runs removed their disposable containers. Failure diagnostics, if produced, are unique private synthetic-only directories under `/tmp`, with exclusively created mode-0600 diagnostic files (directory mode 0700), never public report payloads. No production connection, founder identity, account rows, cookies or proof tokens belong in committed evidence.

## Remaining acceptance gates

There is no existing browser E2E dependency/harness; prior Chromium startup/blank-page captures time out in this runtime. This task did not repeat that probe or add browser dependencies. DOM tests and this HTTP run do not prove real browser interactions, mail deliverability, production recovery/password login, Google/GitHub OAuth, signed desktop pairing/native vault, cloud deployment, rollback or Stripe acceptance. Those remain explicit, separately evidenced workstreams and approval gates. Run TypeScript/build checks after the local development server stops; Next regenerates development types while compiling routes, so concurrent typechecking is not stable.


## Integrated extensions — prepared, not yet accepted

The same guarded fixture now calls separate local HTTP pairing and approval
continuations. Pairing covers authenticated consent, device-bound consumption,
replay denial, identity inspection and owner revocation; it observes existing
identity-only commercial policy without claiming billing enforcement. Approval
uses one synthetic pending row and real concurrent form requests, requiring one
303 winner, one409 loser and one durable actor/time decision. No provider
executor is invoked. Their exact integrated-commit result must be recorded before
these prepared continuations are marked verified.

## Integrated approval HTTP origin qualification

The installed Next.js `NextRequest` normalizes literal loopback IP URLs to `localhost`. The initial integrated fixture therefore received 403 for its literal-IP Origin header, rather than reaching an approval decision. The harness now derives only the approval Origin/Referer metadata with the actual installed `NextRequest` normalization; application, database and mail transport still require literal `127.0.0.1`. Application same-origin checks are unchanged, and the foreign-origin refusal remains tested. This is explicit synthetic HTTP metadata, **not evidence that a real browser at a literal-IP origin can submit the same form**. The committed-source rehearsal subsequently passed on `f7de88f0`; this qualification remains part of its acceptance scope.
