# Proposed one-shot cached recipe export — not yet executable

Source/read-only preparation at `2052e620`, November5. No Node, Prisma CLI, schema engine, sandbox, build, SQL, network, key or provider operation was run. This is the next bounded nonsecret artifact proposal, not installation or Governance qualification.

## Existing actual function and missing safety

`scripts/prepare-synthetic-fixture-recipe.cjs:8–19` already pins the current schema and cached engine, replaces only the datasource environment needle with a nonsecret literal, invokes exactly `migrate diff --from-empty --to-schema-datamodel <private-input> --script`, requires all173 model CREATE TABLE statements, writes new0600 SQL/seed/binding files, and leaves qualification false. Its one existing test `syntheticFixtureRecipe.test.ts` substitutes `ports.run`; no actual CLI/engine was tested there.

**Do not invoke the function plainly.** Its child environment omits `CHECKPOINT_DISABLE`, and `PRISMA_HIDE_UPDATE_MESSAGE` is not a network prohibition. The exact cached Prisma5.22.0 CLI contains default `https://checkpoint.prisma.io` telemetry and `https://binaries.prisma.sh` engine fallback. It also uses `@prisma/engines`/other cached module inputs, so the CLI file hash alone is not its complete dependency provenance. Current `spawnSync(timeout:60000)` is a direct-child timeout, not owned descendant/quiescence proof, and stderr/argv are not preserved by the existing recipe binding.

## Reuse existing bounded supervisor, no new restriction mechanism

The existing `scripts/local_prisma_engine_inputs.py:188–193` `_generation_profile(stage,tmp,logs,protected,read_protected=())` supplies `(deny network*)`, global file-write denial, narrowly allowed owned stage/tmp/log writes, and explicit protected-input write denial. It can express this recipe's writes without allowing cache/source modification: pass a **fresh recipe work directory** as stage, its private tmp/home as tmp, fixed evidence logs, and the checkout/cache/original Node inputs as protected. Use `read_protected=()` here: that parameter DENIES reads, so passing the checkout/cache would break the very CLI/engine imports being selected. The existing policy leaves reads allowed, including fixed original Node, cached CLI/module/engine inputs and ordinary system libraries; it does not create a read allowlist. Child writes to checkout/cache/Node are explicitly denied; fresh recipe work/tmp/fixed logs are the only writable coordinates. Input hashes/currentness and matching offline closure bind the intended trusted build inputs; this does not make them immutable against other host writers. File reads elsewhere remain allowed, so this is not a hostile-compiler or universal secret-read sandbox. Clean env, a fresh private cwd/schema directory with no `.env` files, and the nonsecret literal schema remove intended secret inputs.

Reuse `_run_generation_child(command,stage,environment,log,timeout,file_size_limit,creation_mask)` at lines194–229 for exclusive default-SIGCHLD ownership, original process group only,60s parent budget, bounded logs and one owned kill/at most5s cleanup on timeout. It never signals a reaped/reused group or proves descendant quiescence. Normal launch or synchronous OS calls are not a proven interruptible hard whole-operation ceiling. Unknown cleanup is terminal, preserved and never retried.

A fixed reviewed packet driver should call the **existing** recipe function with its existing `ports.run` seam. That wrapper must add `CHECKPOINT_DISABLE=1`, private `HOME`/`XDG_CACHE_HOME`/`TMPDIR`, clean `PATH`, `LANG=C` and `TZ=UTC` to the function's intentionally replaced child env; preserve `PRISMA_SCHEMA_ENGINE_BINARY` and hide-update setting. No inherited database/env credentials. Run the driver itself under the existing `/usr/bin/sandbox-exec -p <exact-profile> <pinned-original-Node> <fixed-driver>` boundary so its spawned CLI and cached engine inherit network/write restrictions. Do not introduce an alternate engine, downloader or retry/fallback. This wrapper/packet has **not** been implemented or authorized for execution here.

## Actual read-only input observations (rebind before launch)

| Fixed input | SHA256 | Bytes |
| --- | --- | --- |
| Original Node `/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node` | `e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b` |122129232|
| `scripts/prepare-synthetic-fixture-recipe.cjs` |`ce6a329f69d792edcf1461e83be88160b5a094274dfe92b6a068149987d81155`|3131|
| `scripts/local_prisma_engine_inputs.py` |`82e56a85c386ba735a5237c87546e1b41576c37a8f34fdab6769cee36f8743a0`|24010|
| `prisma/schema.prisma` |`50e1fbbf50d5d28ba08e862a72789de3c5a9fdad5d7589751a86e0135c5eb031`|190558|
| `lib/governance/qualification/fixture-seed.sql` |`664f4ab7b1b582b64b0c92fb5577e311e85ec25924e91aad82be99822c3f1750`|1378|
| Cached `node_modules/prisma/build/index.js` |`ff0102cdfadfecb884c5f0b6e43661f4ef2a31917dbfad3157236ba8e8532388`|2235214|
| Cached `node_modules/@prisma/engines/schema-engine-darwin-arm64` |`57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a`|19831920|
| `package-lock.json` |`472bd3b6cabeca9129214fd58f3caf104a973cce0332d2ad3b29d82a8fa86775`|547921|

Also observed cached engines package manifest SHA`eaa81442c1a545b8fb22720a6b50fb4d7e354608590ef0c9384f18755fdfc465` and `dist/index.js` SHA`4ef0c22bbb04f4c54dcb52f0d7156f75c3715a5311ead655bf8920b5e61249a9`. Bind the existing matching offline dependency receipt/full cached closure, not only these examples. Node above is the original build tool, **not** the separately signed runtime Node; this export does not qualify runtime native-engine loading.

## Exact next preparation/execution gates

1. Prepare the fixed packet driver/profile/manifest and pure mocked supervisor tests only. Bind stable no-alias/single-link inputs before/after the child and reserve exact fresh-owned0700 outputs with O_EXCL0600 evidence before launch. Proposed coordinate `/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-recipe-2052e620` was absent in this ordinary file check; it has not been created or reserved. Recheck freshness at the actual packet.
2. Preserve exact driver/profile/input hashes, prepared nonsecret diff-input bytes/hash, CLI argv/cwd/env names, raw stdout and stderr (each at most8MiB), child exit/error and supervisor result. A fixed `ports.run` wrapper can capture these without changing the existing recipe algorithm. Bounded stdout must be the exact generated SQL bytes; don't reconstruct SQL from table names or fabricate command provenance.
3. Only after source preparation/review, ask for **one** network-denied cached-engine recipe-export invocation of that exact packet,60s and no retry. Name sandbox-exec/owned timeout and fresh outputs in the approval; no SQL/database, production migration, installation, signing, credentials, fetch or spending is included. A failed command, attempted forbidden dependency/download, changed input, incomplete173-model coverage, timeout or unknown cleanup stops and preserves evidence.
4. On successful export, recheck current inputs and exact three recipe files/binding, freeze them for subsequent StageA/StageB. An exported schema is not an applied schema, matching actual generated client, usable fixture, valid Keychain policy or completed Governance. Those later gates remain unchanged.

## Subsequent source-only amendment

The input hashes and helper behavior above are observations of2052e620 and remain historical; they must not be relabeled as hashes of later helper bytes. [RECIPE-ENGINE-INPUT-AMENDMENT.md](RECIPE-ENGINE-INPUT-AMENDMENT.md) records the reviewed optional cached-engine path seam and explicit accepted-dependency/original-engine dual provenance. Its later implementation requires a fresh source hash/review receipt before any execution packet; this original observation remains unchanged. No execution approval has been requested or granted by these documents.
