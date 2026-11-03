# Protected-resource typed inventory — local ordinary unit

Source base `81da50ee`. New standalone `protected_resource_inventory.{h,c}`; the old global maxwrite classifier, `axiom_inventory_own_process` and `capability_guard` initializer remain untouched and are not called. No NoWrite/restriction, image/mount, background service, issuer identity, provider action or broad application build ran.

## Exact interface and meaning

`axiom_protected_inventory_own(fixedRoot, fixedBacking)` returns `AxiomProtectedInventoryReport`:

- `AXIOM_RESOURCE_OBSERVED`: bounded resource metadata observed with no detected resource violation. **Not** identity, absence-of-all-aliases proof, provenance, safe anonymous memory or authorization.
- `AXIOM_RESOURCE_VIOLATION`: protected-volume writable descriptor, writable raw-image descriptor/hardlink or maxwrite raw-image mapping detected by device/inode.
- `AXIOM_RESOURCE_INCOMPLETE`: invalid/noncanonical inputs, root not the actual kernel-readonly mountpoint, incomplete/unbounded/changed metadata, or changed root/backing identity.
- Complete/stable flags describe two bounded own-process snapshots. `unattributed_region_count` and `unattributed_maxwrite_count` preserve mappings lacking exact leaf vnode attribution as **UNPROVEN**. They are never inferred anonymous/private from share-mode, external-pager, missing path or BASIC_INFO.shared.

The actual fixed native caller must derive root/backing from the compiled package/native image and validate executable, exact argv, closure and actual restricted-preexec owned origin. No JS/environment/caller boolean establishes those facts. OBSERVED must never bypass those combined gates. Exec plus the reviewed fixed bootstrap closes inherited descriptors/removes prior mappings; that actual flow remains to qualify on the final package. New trusted runtime data memory remains permitted by the reviewed objective; unknown executable/authority use stays a qualification blocker.

## Typed collection and resource rules

Uses SDK declarations only: `proc_pidinfo(PROC_PIDLISTFDS)`, `proc_fdinfo`, `fstat`/`fcntl`, own-task `mach_vm_region_recurse`, `vm_region_submap_info_data_64_t`, `mach_vm_region` BASIC_INFO and `proc_regionwithpathinfo`/`vinfo_stat` from `PROC_PIDREGIONPATHINFO`. No guessed kernel layout or private call.

Raw backing aliases compare device/inode, not filename. Any raw-image mapping with maxwrite is conservatively refused, including private COW; normal runtime is not supposed to map the raw image. Legitimate mounted-root Node COW data is observed under the separately verified kernel-readonly filesystem boundary, not exempted through best-effort VM sharing labels. Coarse parent-region vnode metadata is recorded but not counted as exact leaf attribution. Private heap and unrelated file mappings may be observed; their lineage is not established by this collector.

Bounds:4,096 descriptors,16,384 leaves,64 submap depth,65,536 region steps per scan; exact sizes and overflow/progress checks; two fd and two map scans, root/backing reread. Compare explicit fields rather than C padding. Paths scope inspection only; canonical root must be a mountpoint with MNT_RDONLY. Backing must be a regular canonical file. Caller may not treat this inspection context as an authority descriptor.

## Focused evidence

- Test-first metadata fixture compile failed because the new header/API did not exist. Classifier-specific RED is retained as `classifier-initial-red.log`: missing new classifier symbols, not a reproduced old security exploit.
- An actual own-process scan initially refused nested shared-cache metadata: the single-address recurse lookup had advanced to a submap base before descending. Preserving the requested address on descent fixed the concrete lookup. This was a new collector defect, not a kernel guarantee change.
- Final exact-source `test_protected_resource_inventory.py`: **7 pure classifier cases PASS** with simulated resource context; **7 ordinary kernel/owned-fixture cases PASS**. These counts are separate, not a full Governance matrix.
- Actual ordinary fixture uses existing kernel-readonly OS root `/` plus owned temporary backing/hardlink/files/mappings, **not an Axiom package**. Positive own-process scan complete/stable with explicitly unattributed mappings; writable hardlink fd refused; readonly alias fd observed; closed-fd currentRO/maxRW MAP_SHARED raw backing alias refused by vnode identity; unrelated writable file mapping observed; writable nonmount root and invalid lookup refused. Owned fixture files removed by the fixture; compiled/test evidence retained.
- One preliminary positive raw scan observed187 leaves and34 unattributed maxwrite regions; these are diagnostic observations, not fixed runtime expectations or anonymous-memory proof. See exact final result receipt for the frozen test run.

Final evidence artifact `/private/tmp/axiom-protected-resource-ordinary-r1312hjw/result.json`; copied `ordinary-test-results.json` includes compile exits, run exits and scope. All selected tests terminal0. No actual Node/canonical package scan or same compiled consumer qualification occurred. Current issuer availability/coverage/activation remain unchanged and unavailable.
