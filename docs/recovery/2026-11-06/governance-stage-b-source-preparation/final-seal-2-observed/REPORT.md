# Actual final seal 2 observed

Root-owned controller session 60658 terminated successfully, exit 0, after the independently reviewed fixed Stage C invocation. Raw controller records, all three command stdout/stderr streams, attempts, command records, pre/postseal metadata, final source snapshots and historical template references are preserved byte-for-byte. MANIFEST.json records original paths, hashes, sizes and modes alongside retained copies. The preservation itself performed ordinary file copies only; no signing, verification, display or runtime command was replayed.

Actual result SHA256: 6078b00db6ac529b92a9770b89efaaa0eb374eb29a7ec9b3ad7e47c0212eed1c. The result reports allowedMutationScopeVerified and strictStaticVerificationObserved true. Independent final actual-output review was pending when this preservation checkpoint was written; it is not replaced by this report. Source b8b0314c39324ba3a918fd0f6672faf0297c2041 and accepted package digest 555bc590871e405885ac84de755c27983face39f9a0ed9dcaf19b1122de42b53 remain the provenance.

The historical review-only baseline remains distinct from the fresh execution baseline. No binary, main-before.bin, image, package or SDK payload is copied here. No installation, operational identity, custody, root/account/service authorization, database access or deployment qualification is claimed. The one actual invocation consumed its conditional authority; no retry follows from success or failure.

## Subsequent independent acceptance checkpoint

Independent actual Stage C review subsequently PASSED: exact 15-file postseal inventory including receipt and CodeResources; all 12 non-main files retain full metadata; main SHA181ea91d…/35472 with CDHashfbadfeb7ec8ecc22cf347feb7140a9fedcdbc60d changes only the permitted three load fields and signature tail. Three commands exited0; controller182.5534seconds. Earlier pending-review prose above is preserved as historical. This establishes static acceptance only, not installation or custody.
