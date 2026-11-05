# Dormant native adapters: local evidence

No unmodified operational native module, maintenance entry or real supplier OS path was executed. Only the documented isolated test binaries ran; all Security/Keychain function calls in those tests were inert mocks. No installation, credential generation, account/service action or resource access occurred. The maintenance entry has no arguments, main, runtime export, registration, environment selector or activation path; it uses fixed source-only nonsecret synthetic patterns. Its module remains unlinked from app/runtime targets. These values establish no DB compatibility or operational custody.

Changed source: `synthetic_resource_provisioner.{h,m}`, `origin_private_resource_supplier.m`; isolated test: `synthetic_resource_adapter_mock_test.m`. Shared contract/parser/coordinator and builder getters are owned by the parent work unit.

Strict compile only (both exit 0, empty logs):

```
clang -fobjc-arc -Wall -Wextra -Werror -Wno-deprecated-declarations -c packages/verified-issuer-runtime/native/synthetic_resource_provisioner.m -o /tmp/axiom-synthetic-provisioner.o
clang -fobjc-arc -Wall -Wextra -Werror -Wno-deprecated-declarations -c packages/verified-issuer-runtime/native/origin_private_resource_supplier.m -o /tmp/axiom-synthetic-supplier.o
```

Deprecated local Security/CSSM interfaces are explicitly acknowledged by `-Wno-deprecated-declarations`; other warnings are errors. Initial compile without this exclusion failed on existing deprecated CSSM header types, then strict compilation passed. Actual module linking is part of parent integration verification. No compiled actual module is run or loaded.

The isolated mock test compiles actual adapter source into a separate test translation unit. Every Security function referenced by that source is renamed at preprocessing time to an inert mock; policy functions are inert mocks. Security framework linkage supplies constants only. Foundation/CoreFoundation allocation and dictionary/data operations execute; actual Security functions do not. Before test execution, undefined symbols were inspected with `nm -u`; the check rejects any original `_Sec`, `_CSSM`, or `_ax_cssm` function import. The tested journal/publication functions also use renamed inert filesystem calls, with no actual file publication or sync. The native maintenance entry and protected-path function are never invoked by the test.

```
clang -fobjc-arc -Wall -Wextra -Werror -Wno-deprecated-declarations packages/verified-issuer-runtime/native/synthetic_resource_adapter_mock_test.m packages/verified-issuer-runtime/native/synthetic_resource_contract.c -framework Foundation -framework Security -o /tmp/axiom-synthetic-adapter-mock
nm -u /tmp/axiom-synthetic-adapter-mock
/tmp/axiom-synthetic-adapter-mock
python3 docs/recovery/2026-11-05/governance-installed-resource-local/adapter/source_contract_test.py
```

Only the separate test binary was executed, with no argv and no task-added environment variables. Its Add mock checks exact seven-key requests, fixed service/ordered roles, same exact mock Keychain/access handle, data bounds and persistent-ref-only return; checks duplicate/refusal and wrong/oversized locator returns. Journal mock observes write/file-sync/directory-sync order. Publication mock observes exclusive/no-follow staging creation, ownership/mode, write/file sync, exclusive rename and directory sync; collision and uncertain sync prevent success. Mock success is source composition only, never OS enforcement, effective ACL semantics or storage durability.

`red.log` records the initial missing-adapter source assertion before implementation; `green.log` is its later pass. Behavioral mock tests were added after implementation. `mock-mutation-red.log` confirms a deliberately altered temporary copy returning data instead of persistent references fails the real shape assertion; this is mutation evidence, not a claim of complete behavioral test-first TDD. `mock-green.log` records the unchanged adapter pass. Temporary mutated copies live under `/tmp`, and were not production source changes.

Remaining gaps: actual installed package/principal/pre-main identity, System-Keychain backing identity/replacement, complete policy enforcement, copied/different/same-team code denial, actual UI denial, runtime delays, filesystem permission/mount/ACL enforcement, power-loss durability and supported-platform qualification. Supplier operational remains literal zero and cannot be enabled by a mutable flag or record. No positive installation/custody, A2 closure or whole-Governance completion is claimed. Source-only checks do not replace required supplier negative behavioral mocks and later independently authorized operational qualification.

Additional isolated closed-gate test: `synthetic_supplier_gate_mock_test.m` replaces every Security function (including type ID/free/owner/access/query methods and UI setter) with aborting inert mocks; policy methods also abort. Original function imports were rejected by the same `nm` check before execution. The separate test binary checks literal operational zero, first/repeated startup refusal, denied read, zeroed staging, cancellation and null output. Every Security path would abort the test. This tests the actual closed gate only, and does not claim the positive resolution/ACL negative matrix.

```
clang -fobjc-arc -Wall -Wextra -Werror -Wno-deprecated-declarations packages/verified-issuer-runtime/native/synthetic_supplier_gate_mock_test.m packages/verified-issuer-runtime/native/synthetic_resource_contract.c -framework Foundation -framework Security -o /tmp/axiom-synthetic-supplier-gate-mock
nm -u /tmp/axiom-synthetic-supplier-gate-mock
/tmp/axiom-synthetic-supplier-gate-mock
```

`gate-build.log`, `gate-imports.log`, `gate-import-check.log` and `gate-green.log` capture this test. It executes no actual native module or actual Security function, takes no arguments and adds no environment selectors.

## Extended scoped-resolution preparation evidence

The earlier missing supplier negative-mock coverage is partially superseded by `synthetic_supplier_resolution_mock_test.m`: the actual private `resolve_reference` helper (also used by actual startup loading) constructs the exact five-key scoped query and invokes the actual full item inspector. The test substitutes every Security API with inert simulated objects, supplies a clearly simulated owner/ACL/keychain fixture copied from the existing pure CSSM test, and links the real pure CSSM copier/inspector. It does not stub inspector success and does not enable operational or installation context.

The test asserts exact single CFData locator identity, exact single explicit Keychain identity, class, match-one, return-ref and absence of service/account/data query keys. A simulated positive and 19 rejection cases cover status/null/wrong item type, wrong containing Keychain, class, missing attributes, count/tag/value/data-pointer/null-array, UID/GID/owner type, extra/empty ACL export count, unknown policy, ANY subject, and modified application requirement. Invalid helper arguments refuse. All original Security/CSSM function imports are excluded by `nm` inspection before executing the separate mock test binary. No actual Security call or filesystem/resource operation occurs.

```
clang -fobjc-arc -Wall -Wextra -Werror -Wno-deprecated-declarations packages/verified-issuer-runtime/native/synthetic_supplier_resolution_mock_test.m packages/verified-issuer-runtime/native/synthetic_resource_contract.c packages/verified-issuer-runtime/native/cssm_policy_copy.c packages/verified-issuer-runtime/native/cssm_policy_inspect.c -framework Foundation -framework Security -o /tmp/axiom-synthetic-supplier-resolution-mock
nm -u /tmp/axiom-synthetic-supplier-resolution-mock
/tmp/axiom-synthetic-supplier-resolution-mock
```

Logs: `resolution-build.log`, `resolution-imports.log`, `resolution-import-check.log`, `resolution-green.log`. `resolution-red.log` records the missing private helper before this refactor. `resolution-mutation-red.log` records the expected null-array crash when only the attribute-array guard is removed in a temporary mock copy; original Security imports were excluded before that test too. This supplements mutation evidence, not a claim of full test-first coverage.

Supplier fixes include explicit null attribute-array rejection, retained item/Keychain cleanup on load failure, and root-owned mode0755 ancestor acceptance independent of GID (new record files still require GID0). The export-allocation-bound comment was removed: repeated full inspection allocation/lifetime behavior remains unqualified. Actual production source compiles cleanly and the closed-gate test was rerun with all Security methods aborting mocks. Installed/principal/pre-main/backing/effective-policy qualification and real read/late-result/context-change behavior remain unqualified; no positive startup acceptance is asserted.

## Derived read-body simulation

`synthetic_supplier_read_mock_test.py` prepares an isolated temporary translation unit for `synthetic_supplier_read_mock_test.m`. It changes exactly one private `installation_context` function body to an explicitly simulated context port. The rest of the supplier source, including `reference_read` and the complete public read body, remains byte-identical. The transform asserts exact replacement cardinality, reverses the replacement and checks byte equality to the original, and confirms that the production file is unchanged after testing. `read-transform-receipt.json` binds original/derived/test SHA256 hashes, exact before/after strings, actual build/run argv and zero task-added environment variables. The temporary directory is removed after the isolated test; no derived production artifact is installed or retained as a runnable supplier.

```
python3 packages/verified-issuer-runtime/native/synthetic_supplier_read_mock_test.py
```

All Security functions are inert mocks, original function imports are excluded by `nm` before execution, and clock/context changes are explicit simulation. The pure existing CSSM copier/inspector still performs real structural checks against simulated framework graphs. The production operational gate is never replaced and still asserts zero in this test; no startup or installed authority acceptance is asserted.

Coverage: valid three-resource read, maximum8192-byte datasource and4096-byte session read;27 direct role-by-case rejection paths for status failure, null returned data, wrong class, undersize, oversize, cancellation after return, deadline expiration after return, context loss after return and policy mismatch after return. Late results never copy into output and leave the caller length unchanged. Every nonnull mock content buffer is zeroed before the mocked FreeContent, including buffers returned alongside failure. Cancellation/deadline/context refusal before read observes zero Security calls. Full read tests fail during a later resource, wipe all partial staging, burn the epoch, and refuse later requests. Early context/deadline/cancellation denial also burns the epoch and refuses a later otherwise-valid request with zero Security calls. Each independent scenario explicitly resets only simulated process state; no production reset hook exists.

`read-build.log`, `read-imports.log`, `read-import-check.log`, `read-green.log`, and `read-transform-receipt.json` contain evidence. These are pure/mock composition checks, with no actual Security/resource/native-module execution, operational predicate activation, installation/principal qualification or real latency/enforcement/durability claim.

Parent integration follow-up: strict C11 integration exposed undeclared memset_s; parent replaced only the supplier data wipe with a standard volatile loop. The current read suite was rerun against that exact updated source; earlier read receipts are preserved in read-before-c11-portability-fix/. Parent also permits any nonwritable ancestor GID in provisioner directories, matching the root-owned0755 design; new record files still require root:wheel. Actual objects/bundles were linked but never loaded/run.
