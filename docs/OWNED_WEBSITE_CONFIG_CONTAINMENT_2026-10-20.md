# Owned website configuration containment — October 20, 2026

This source proposal addresses output containment in the existing isolated
website fixture. It does not establish that the website hydrates, that Play
works, or that a redesign has passed browser acceptance.

## Confirmed configuration defect

The installed Next.js 16.3.8 `NextCustomServer.prepare()` calls
`getRequestHandlers()` without forwarding `options.conf`. The router then loads
the actual `next.config.ts` without `customConfig`. The fixture's previous
`ownedNextOptions()` therefore did not contain the effective output directory.
The fourth historical browser attempt retained an ordinary `.next/dev` tree,
while the supervisor counted and removed only its declared `.next/visual-*`
directory. That attempt's hydration failure remains unattributed.

Changing to `customServer:false` is unsuitable: Next rejects its combination
with `webpack:true`, and the internal development server expects an initialized
bundler service. The existing public custom-server path remains intact.

## Narrow correction

`next.config.ts` returns the original configuration object for ordinary builds
and serving. Only an existing owned-website fixture context activates the new
config-file adapter. It requires the exact development phase and environment,
private owner directory/config file, canonical checkout, nonce, pinned framework
identity and adapter bytes, and a direct `.next/visual-*` child with its existing
private tsconfig extending the checkout's real `tsconfig.next.json`.

Configuration reads are bounded, reject symlinks and nonregular files, and check
file/directory identity. Malformed or production fixture contexts fail closed.
Only `distDir` and `typescript.tsconfigPath` change. The launcher includes the
adapter in its existing source manifest; the framework pin follows the reviewed
`next.config.ts` bytes. No transport, process, worker, environment or application
request policy is relaxed.

Next intentionally appends `/dev` during development. The resulting
`.next/visual-<owner>/dev` stays below the existing recursively counted and
owned-only cleanup root. No ordinary `.next/dev` tree is removed. Old manifests
do not authorize this changed source; a fresh exact-source review is required
before any subsequent server/browser window.

## Verification scope

A new regression first failed against the real installed config loader because
`distDirRoot` was `.next` rather than the declared owned root. After the change,
the real `loadConfig()` path **without `customConfig`** and its repeated load
returned the owned root, nested dev directory and private tsconfig. An ordinary
production-phase config load retained `.next` and `tsconfig.next.json`. The
existing guard reported zero transport, process, worker and listener operations.

Focused tests additionally cover ordinary object identity, production/wrong-mode
rejection, contradictory owner fields, missing/unowned paths, source/identity
drift, config/output/tsconfig symlinks, private file permissions, tsconfig drift,
and the launcher's actual recursive byte accounting with nested dev output.
The existing TypeScript-API regression now inherits managed environment controls
instead of dropping them in its test subprocess. The runtime fixture's child
environment and guards are unchanged.

The initial default-sandbox test could not spawn its config-only child (`EPERM`);
the focused native-permission run reproduced the intended failing assertion and
then passed. The initial four-file focused run passed 98 tests. After adding
the remaining mode/tsconfig/accounting cases and preserving the existing test
subprocess's controls, the final two affected files passed 53 tests. The full
default suite and compiler were not run for this source proposal. Vite's existing
native-config-loader compatibility warning was retained, not suppressed.
The dependency graph is the existing local reviewed cache, not a
fresh install or an independent package-integrity attestation.

No application server, fifth browser attempt, full compiler, production call,
deployment or installer publication was performed for this proposal. Full
integration gates and rendered website acceptance remain with the root agent.
