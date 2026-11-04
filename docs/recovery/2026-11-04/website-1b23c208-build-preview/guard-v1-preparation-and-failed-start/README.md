# Prepared guarded local preview — source 1b23c208

READY for independent source/evidence review. **Neither server has been started.** Preparation only; separate root authorization is required before startup or owned HTTP/browser checks. Existing previews/sessions untouched. No app/stage/source changes, installs, provider/auth/DB/native/credential/Security/helper/AI operations.

Owned directory: `/private/tmp/axiom-preview-harness-1b23c208-20261104`.
Exact existing built stage: `/private/tmp/axiom-website-1b23c208-eh6g339f/stage`.
Fixed future backend `127.0.0.1:5225`, proxy `127.0.0.1:5224`; wrapper `/__axiom_preview`.

## Corrected audit and evidence

Original proxy SHA256 `d75d2dd631dd8ad302e9e492ad58983573df690b96a6337bbc65f88cc873ec59`. The named historical startup script was absent; none is claimed verified/reused.

Three actual gaps reproduced against the unchanged old proxy: optimizer inner `/api/auth/session` accepted; arbitrary nonasset `*.png` path accepted; response Refresh/Link passed the old denylist. Initial red.log has three failures and one passing negative. **The earlier escaped-literal assessment was overstated: the old function rejects the tested single-backslash path. Neither single-backslash nor NUL is claimed as a demonstrated old vulnerability.** That passing safety case remains in original evidence and final negative coverage.

Canonical forwarding is an added hardening contract, not a fourth exploit. The old handler validates decoded path but forwards original raw target. `/%64ocs/permissions-model` is an alias, not proof of private-route reachability. canonical-red.log records the initial pure adapter assertion; actual-forward-red.log subsequently exercises the real old GET handler with a fake connection and captures its raw forwarded target. That run has three actual-gap failures plus one separate canonical-contract failure. No socket/network/server was used.

The first corrected green.log had eleven passes/one test-expectation failure: an exact built `[token]` chunk path correctly canonicalized to `%5Btoken%5D`, while the test expected unencoded bytes. The expectation was corrected to compare decoded identity; no route broadening. final-green.log has twelve passes; prepared-green.log has fourteen passes after fixed-launcher/profile input checks. Exit files preserve every invocation. No missing-module failure is represented as behavior RED.

## Guard scope

`asset-manifest.json` observes exact regular nonsymlink built assets:22public images,35public images/fonts,1150.next/static files and47explicit public pages. Pages use prior reviewed public routes plus actual built docs/demo routes, not arbitrary prefixes. Required existing logo/brand/demo images and optimizer URL for `/vision-xix-logo.png` pass pure tests; all exact static paths pass. There is no extension-based permission or optimizer app/API/remote target.

Strict once-decoded canonical paths reject controls, backslashes, residual/malformed encodings, dot/double-slash segments and private prefixes. Optimizer query accepts exactly one literal url/w/q key, exact manifest image and built supported width/quality; duplicate/extra/encoded keys and nested query/remote targets refuse. The real handler forwards only the vetted canonical target. Page/static query strings are deliberately unavailable; no RSC/router-protocol qualification claimed.

Request forwarding permits Accept/Accept-Language only. Cookie, Authorization, Host overrides, Next-Action, all RSC/router/Next headers are omitted. Response headers permit only content-encoding/language, ETag and Last-Modified; Refresh/Link/Location/Set-Cookie are never forwarded. All3xx/Location/Refresh responses are refused. NonGET/HEAD actions including TRACE/CONNECT refuse before backend access. Responses are32MiB-bounded; CSP retains self-only resources/connect, form-action none, base-uri none, nosniff. Preview banner states HTML/static only and forms/backend actions disabled.

## Launcher preparation, not execution

`launch_preview.py` has no import-time launch. Main accepts only backend or proxy, verifies launch-binding hashes, exact BUILD_ID/config/Node/Next CLI, all regular asset bytes/root bounds and absence of runtime .env files, then would exec a fixed sandbox command. Only `.env.example` was present. It uses cleared synthetic environment, pinned Node24 and synthetic dead-loopback DATABASE_URL; no inherited credentials/issuer settings. No missing old-script assumption.

backend.sb denies outbound networking and filesystem writes, permits only loopback inbound/bind5225. proxy.sb denies other network operations, permits only loopback inbound/bind5224 and outbound5225, denies filesystem writes. Profiles are prepared source only: they have not been compiled/applied or runtime-qualified. No actual startup/output/image optimization under read-only caching has been established. Pure tests verify source contracts and existing byte identities, not served images, browser/AT/RSC behavior, immutable custody, installed identity or full website acceptance. Path/write-denial text is not a claim about retained-descriptor native custody. Any later startup/report redirects are explicit operator evidence writes, not application persistence authority.

## Exact pure test invocations

Each used `/usr/bin/env -i PATH=/usr/bin:/bin HOME=OWNED TMPDIR=OWNED PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 OWNED/test_harness.py` with explicit operator stdout/stderr redirects and captured exit status. `--old` selected only the old proxy adapter/handler, never its server main.

- Initial RED chunkbaaa13:exit1,3fail/1pass; log red.log.
- Canonical adapter RED chunkba1c5a:exit1,4fail (3gaps+1hardening); canonical-red.log.
- First corrected attempt chunkbace1d:exit1,11pass/1encoded-static expectation failure; green.log.
- Actual old-forward handler RED and corrected final GREEN chunk425b58:exit1/0,4fail then12pass; actual-forward-red.log/final-green.log.
- Final prepared source/assets/profile suite chunk4e560e:exit0,14pass in0.144s; prepared-green.log.

No tests start server, issue HTTP/provider requests or import application code. Fake connection captures actual handler target only. Launcher preflight only reads fixed prepared/build inputs; execve is replaced and verified uncalled. Current build asset/binding checks pass without stage writes. Fresh processes/ports and runtime checks remain pending separate authorization.
