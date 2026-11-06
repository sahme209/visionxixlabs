# Source-only full peer helper proposal

No compiler or test child has been invoked. No existing passing source packet, runner, recipe, fixture or receipt has been changed. The only fixture edit is one exact fixed PASS puts in the existing argc-two controller branch; its previous bytes are preserved in `before-controller-stdout.c`.

## Protected-call audit

The actual complete `system_peer_binding.c` and shared `protected_acl_empty.h` are included normally by `tests/system_peer_binding_test.c`. `CALLGRAPH-AUDIT.json` records all 28 redirected calls and seven own-fixture Security globals.

* File/ACL effects: open, openat, close, fstat, pread, acl_get_fd_np, acl_init, acl_size, acl_copy_ext, acl_free resolve to inert fixture bodies. Fake file descriptors are integers; pread copies only the fixture's synthetic 128-byte array. No real descriptor, filesystem or ACL function is used.
* CoreFoundation: CFURLCreateFromFileSystemRepresentation, CFStringCreateWithCString, CFRelease, CFGetTypeID, CFDictionaryGetValue, CFDictionaryGetTypeID, CFDictionaryGetCount, CFNumberGetTypeID, CFNumberGetValue, CFDataGetTypeID, CFDataGetLength, CFDataGetBytePtr, CFStringGetTypeID, CFStringGetCString all resolve to fixture functions operating on fake constants/structs and memory buffers.
* Security: SecStaticCodeCreateWithPath, SecStaticCodeCheckValidity, SecCodeCopySigningInformation, SecRequirementCreateWithString all resolve to fixture functions; no signature verification, requirement creation or Keychain call occurs. All referenced kSecCodeInfoFlags, DigestAlgorithm, Identifier, TeamIdentifier, EntitlementsDict, Entitlements, Unique globals are defined in this fixture. Remaining framework names are types or numeric enum constants. No Security/CoreFoundation implementation or framework link is requested.

The actual unmocked CC_SHA256 is a keyless memory hash of the synthetic 128-byte image. It is needed to test actual before/after byte-currentness, including synthetic tampering during simulated signing observation. The bound fixed SDK CommonDigest.h declares its plain C API; the already-bound libSystem.B.tbd exports `_CC_SHA256`. The SDK header also describes linking digest functions against libSystem. No separate crypto or Security library is linked, and no keys or real image are supplied. This is a narrowly proposed pure-memory digest call, not qualification of actual code signing.

## Proposed finite import additions

The separate copied guard proposes the same finite additions for the two fixed test selectors: `_CC_SHA256`, `___error`, `_strcmp`, `_strchr`, `_strlen`, `_strtok_r`, `_strstr`, `_strcpy`, `___strcpy_chk`, `_snprintf`, `___snprintf_chk`. The baseline memory/allocation/puts/assert imports remain unchanged. No wildcard or protected CF/Sec/ACL/file/process/network import is allowed.

The strings serve actual local path splitting/comparison and fixture assertions; strcpy copies fake strings into local buffers. snprintf formats the actual fixed signing expectation in a local 256-byte array. Bound SDK secure/_string.h and secure/_stdio.h explicitly lower these operations through exact fortified builtins where enabled. Bound sys/errno.h maps errno to the thread-local `__error()` accessor: actual hash_image's negative-pread/EINTR branch creates that potential import, although fake pread never returns negative. This accessor is process-local state, not a protected operation. All additions require independent source review and subsequent actual binary import/map review; source predictions are not compiled-output evidence.

## Fixed recipe and cases

One strict C11 ARM64 compile, without optimization/modules/framework links or operational definitions, includes only the actual fixture translation unit. Outputs are fresh `ROOT/peer/peer-test` and its map. One fixed default test invokes it with no arguments; a distinct fixed controller test supplies exactly `fixed-controller-case` to select its existing argc-two branch. There are no arbitrary selectors or argument forwarding.

Default cases retain actual owner/broker positives, retained descriptor ownership, ownership/gid/mode/link/ACL mismatch/copy-error/open/signature-profile/entitlement/hash/header/architecture refusals, synthetic signing-time mutation, post-capture image/inode changes and invalid role handling. The separate controller branch retains actual prepare/currentness, fixed controller coordinate assertion, synthetic byte tamper/revocation and wrong-identifier refusal. No simulated observation is elevated into real signing evidence.

The sole ROOT ledger is reused, with a minimum 14 already-consumed invocations and the original 32-child/480-second whole-unit caps. Child limits stay 30 seconds/64-KiB combined output/five-second cleanup/core zero, with fixed CLT tools, SDK alias verification and original network-denying sandbox. Tests require their common peer-compile step and distinct reviewed binary/map pins, currently absent. Root owns every actual compiler/test invocation after independent review. No automatic retry or new budget is created.

Default stdout remains exactly `actual protected peer helper: positive2 and bounded rejection/currentness cases passed with inert platform mocks\n`. Controller stdout is exactly `actual protected peer controller positive/currentness/tamper/refusal with inert platform mocks: PASS\n`. Each requires exit zero and empty stderr. Actual binary/map and final currentness reviews remain pending. No actual platform ACL, signing, installation or runtime authority claim follows from these local fixtures.
