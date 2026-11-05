# One expanded image-content and v2 assembly bundle — design only

The existing driver/controller remain unexecuted and currently exclude mounts. Do not run them to claim this expanded procedure. Requested authority would cover preparing and testing this exact bounded executor, then **one** real run only after independent source/test/frozen-binding review passes. No retry, key use, privilege, installer or issuer permission is included. The code is not implemented yet.

## Exact accepted inputs and outputs

Reuse the same completed0b0 package/digest, four unchanged materialized/original signed companions and separate v2 main; all records, helper/initializer hashes and image argv are fixed in operation-inputs.json. Keep fresh run/controller paths, 600-second image deadline, 4,906,287,104-byte image cap, 10,349,445,120-byte free-space threshold, 1,800-second overall controller and1MiB aggregate output bound. No new build, materialization or signing.

Create the image once using the existing fixed argv. A new private empty mount directory is:
`/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/mount`

This is a user-owned inspection location, **not** the native `/Volumes/Axiom Synthetic Issuer-…` runtime coordinate. No runtime identity/root-topology claim follows from using it.

## Proposed bounded mount/content/detach sequence

1. Preserve source-image hash/size/mode and the current accepted source package observation before attachment. All directories must be created with umask0077, then checked owned0700 and nonalias; image creation can use0177, restored before directory creation. Never overwrite/reuse an existing run, mount directory or image.
2. Invoke exactly once, with a90-second direct-child deadline and at most256KiB combined captured output:

```
/usr/bin/hdiutil attach -readonly -nobrowse -noautoopen -plist -mountpoint "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/mount" "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/image/issuer-package.dmg"
```

Require actual exit0 and a bounded parseable plist with exactly one reported mount at that exact path, no other reported mountpoint, and its exact device entry as a bounded literal matching only `/dev/disk[0-9]+(?:s[0-9]+)*` (ASCII, at most128bytes, never an option or arbitrary path). Save the actual command/result/stdout/stderr bindings and confirmed root device/inode identity. Check the actual filesystem read-only bit with an ordinary statvfs read. Do not infer successful ownership from a proposed path, a caller flag, process output alone without exit0, or a failed/ambiguous attach. Unsupported result stops unknown; no second attach, generic disk enumeration, native target or alternative mount.
3. While the exact confirmed read-only mount remains present, call the existing `manifest.verify_package` on it. Require its whole-file-set digest to equal `2e5f4ee2a874e9bcc9fa19fdc57e5c6956108a6dd529b87a6c122fc36221aace`, and mounted raw manifest SHA256/source revision to equal the accepted source manifest. No new exclusion list or relaxed metadata semantics. No Node, addon or compiled consumer execution. Rehash the image afterward and refuse any image/source change.
4. Detach once only when the new attach was positively confirmed owned and its exact current read-only mount path/device/inode identity still matches the saved observation and the source image hash/size/mode still matches before use. Use `/usr/bin/hdiutil detach <exact device entry returned by that attach>` with60-second deadline/output bound. This device is selected from that single bounded result, never guessed, enumerated or adopted. Require successful detach before real app assembly; preserve exact command/result evidence. No force detach, retries or generic cleanup. If attach ownership is unknown, do not detach speculatively. If verification fails after a confirmed owned attachment, attempt this same single bounded detach only while ownership remains confirmed; retain the original failure and do not proceed. **An unknown attach or detach result may leave a live mounted image.** Preserve that state prominently as unknown; a later human decision/inspection is required. Never claim cleanup, probe by retry, adopt a different mount or detach speculatively.
5. After confirmed detach, save a new mounted-image-content observation joined to attach/inspection/detach records, source packageDigest/raw manifest/source revision and unchanged image binding. This qualifies only the observed ordinary image file set at that inspection mount. It does not qualify native mount/root custody or an executing issuer. The image completion input must bind this observation, rather than merely assert an image-created flag.
6. Invoke the already reviewed fixed v2 assembly once with that exact image and prior unchanged companions/main. All source checks, fixed new-copy modes, five-field control binding, output provenance and false runtime/signature/installation flags remain. No final app signature or app launch.

## Executor preparation and review gates

Before running: implement only this fixed command sequence and a bounded three-command image/attach/detach runner; no arbitrary command/selector API. Pure/mock owned-file tests must cover exit0/ambiguous/nonzero/timeout attach, exact mountpoint/device selection, read-only check, digest/raw-manifest mismatch, image mutation, ownership loss before cleanup, successful single detach, detach timeout/failure and no app copy until confirmed detach. Preserve the existing controller's original-unreaped-process-group ownership rule. Inherited RLIMIT_FSIZE and output/wall bounds are best effort for the owned group, not universal OS-helper containment or descendant quiescence.

Independent review must verify actual code and test evidence, then freeze exact executor/helper/input hashes in the final operation packet. The current image/copy-only source is not that executor. A single user decision may authorize this exact conditional preparation/test/freeze-then-one-run bundle; failure of any review, bound, ownership or currentness gate stops without substituting the earlier draft or automatically retrying.

Excluded: signing/Security/Keychain, native/Node/container execution, root/account/service/installation, real credentials/resources, provider/database/deployment/spending, forced detach or publication. Actual final-seal allowed-mutation validation remains unimplemented and must be reviewed before any future key use. Mandatory sealed_control, actual runtime root, same compiled consumer, custody, fleet and Governance completion remain unavailable. Historical inputs/receipts stay immutable.
