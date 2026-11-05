# Expanded one-shot image inspection and v2 assembly — prepared, not run

Conditional approval `call_nAel7PPZG3HBVPUfSg43CdAx` permits preparation/tests/review/freeze, then one exact run after those gates pass. Independent source review reports no important remaining findings. One combined focused selection passed **34 tests** using synthetic owned files and mocked processes/mount metadata only. Exact frozen hashes are in `source-bindings.json`; helper byte hashes and immutable real-input bindings are in `operation-inputs.json`. The approved design remains unchanged at SHA256 `673b491c2b7b0121d88053014963caa9d8560b317bf683ae113b7b7dd8e2e89b`.

**ROOT owns the actual invocation. This agent has not run the controller, driver, hdiutil, actual package verification, mount or real assembly.** No actual host free-space query ran during preparation.

## One fixed entry and existing inputs

After the frozen source/test/review gates, invoke once:

```
/usr/bin/python3 -B /Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/governance-real-container-assembly/prepared-assembly-controller.py
```

Reuse accepted source `0b0e8b48aa3469c1146bc2db38cdce4b2dc1a43d`, canonical package digest `2e5f4ee2a874e9bcc9fa19fdc57e5c6956108a6dd529b87a6c122fc36221aace`, its four already-materialized companions/original signed inputs, and the separately compiled v2 main. No compiler, materializer, Node/native target or leaf signing is repeated.

Fresh private run root: `/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1`. Controller uses the fresh sibling `2026-11-05-real-container-controller-558f12f1`. An existing root refuses, with no reuse or retry. Implementation helpers are frozen by byte hashes, including the package initializer and new inspection module; the base558f revision is historical, not a claim that the expanded source existed in that earlier commit.

## Bounded ordered operation

1. Verify frozen helpers/initializer/input records. Cheaply preflight actual main preparation/compile shape and exact four companion inventory/original bindings before creating an image. Use the accepted package verifier; no new verifier or altered manifest exclusions. Check ordinary filesystem free space once at runtime: recorded package logical bytes **3,709,521,252**, required free space **10,349,445,120**. Current free bytes remain pending.
2. Set process umask0077 before private directory creation. Claim one fresh run. Set0177 for image child file creation and inherited soft `RLIMIT_FSIZE` **4,906,287,104 bytes** without increasing a lower hard limit. One fixed hdiutil create, **600-second** deadline:

```
/usr/bin/hdiutil create -srcfolder "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-system-build-0b0e8b48/materialized/package" -volname "Axiom Synthetic Issuer-c3b7bf334ce56a64575183b7a66e5109" -format UDRO -fs HFS+ "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/image/issuer-package.dmg"
```

Only exit0/regular bounded output is adopted; new image mode becomes0600. Recheck original package. Record exact command, source packageDigest/raw manifest SHA/source revision and actual image hash/size. No overwrite, conversion or retry.
3. Restore umask0077 before inspection directories. Save original private empty mount-directory dev/inode. Attach once with **90-second** deadline and **256KiB** combined captured output:

```
/usr/bin/hdiutil attach -readonly -nobrowse -noautoopen -plist -mountpoint "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/mount" "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/image/issuer-package.dmg"
```

Ownership needs actual exit0, exactly one reported mount at that exact location, a bounded literal device matching `/dev/disk[0-9]+(?:s[0-9]+)*`, and observed namespace dev/inode different from the original empty directory. No generic enumeration, option/device guessing or `st_rdev` equivalence assumption. Save actual root dev/inode and read-only bit. This is a private inspection mount, **not** the native `/Volumes/...` runtime root.
4. Require actual read-only filesystem state and invoke the existing `manifest.verify_package` on that mount. Require accepted digest plus raw manifest SHA256/source revision. No Node, addon or compiled consumer executes. Rehash the unchanged image. Policy/content failure still permits one detach when ownership is positively known and current; unknown attach, identity loss or image mutation permits no speculative detach.
5. Detach once only: `/usr/bin/hdiutil detach <exact literal device from that attach>`, **60-second** deadline/output bound. Recheck current mount identity and image first. After exit0, require the mount path absent OR restored to the original private directory dev/inode on a non-read-only filesystem. Otherwise cleanup remains unknown. No force, retries or alternate target. **Unknown attach/detach may leave a mounted image and needs a later human inspection/decision; no cleanup success is invented.**
6. After confirmed detach and image equality, persist mounted-content observation binding attach/logs/content/device/namespace/detach and package/image identities. The image completion must bind it; assembler rejects missing/failed/unjoined observations. No real app copy occurs before these gates.
7. Invoke reviewed fixed v2 assembly once at `<run-root>/assembled`, preserving all original authoritative bytes. Only new-copy named modes change. Main is distinct from authoritative leaves and not company-signed; native five-field control uses **raw manifest SHA256**, not packageDigest. Invoke existing `verify_assembly` and require exact equality with the returned assembly before terminal success. No app launch/signing occurs.

## Controller and stop semantics

Overall driver limit **1,800 seconds**, combined forwarded/persisted output **1MiB**. Inner inspection children have bounded output, hold their owned direct child until their sole wait, and kill only that still-unreaped child on failure. Outer controller retains its original driver until wait, may clean up only its owned original group, and never signals a numeric group after reaping. Full OS-helper/descendant quiescence and universal interruption of blocked kernel/storage calls remain unavailable. Source/package/image hash and copy checks remain bound to this overall deadline; timeout or any uncertain phase stops with preserved evidence and no automatic retry.

Failure records preserve `possibleMountedImage` for inspection uncertainty. Originals, completed package and historical receipts are never deleted or rewritten. Incomplete new run evidence is retained, not reset or adopted into success.

## Unavailable qualification

Success means ordinary observed mounted image file set plus verified **preseal** v2 assembly only. No signature validity, `sealed_control`, runtime mount/root custody, executing issuer, same compiled consumer, fleet/native enrollment or full Governance qualification. Final-seal observation remains a synthetic/preseal shape helper, **not an actual post-seal validator**; actual allowed-mutation validation must be reviewed before future key use.

Excluded: codesign/Security/Keychain/key use, native/Node/container execution, root/account/service/install, real credentials/resources, provider/database/deployment/spending, forced detach or publication. No app/site restart. All execution/installation/activation identity flags remain false; the user's conditional tool-operation permission is distinct from issuer authority.
