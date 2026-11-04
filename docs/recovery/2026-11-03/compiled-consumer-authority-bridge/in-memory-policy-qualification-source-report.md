# Source-only in-memory qualification preparation

Status: **UNCOMPILED / UNEXECUTED Security helper; independent source review pending.** Base `ad8efae1`. No master/status/rulings changes. Canonical supplier gate remains false; business channel remains unmounted. No installed policy, effective authority, custody, executing issuer, provider, DB, or original blocked-case qualification follows.

The same builder and copier are retained. Builder changes only select two source-fixed literal paths (default0 canonical unallocated path; profile1 pinned fixture; any other value compile-refuses), and record stage/status/phase. No caller path, environment override or issuer was added. The source-only helper invokes the builder once, adds precisely the seventh final export, and checks a separate final application-only inspector. Successful source trace has seven Security calls and two CFArrayCreate calls. Failed CF allocation/copy is distinguished by fixed phase; its numeric OSStatus is the last returned Security status, not a fabricated CF status. Objects remain retained to process exit.

Inspector checks root-process owner, one application-only entry, two exact nonduplicate rights, delegation, validity/tag/handle representation, complete typed signature subject and all opaque bytes. Both graphs validate before comparison; input bounds are256 nodes,64KiB datum bytes, no nested application sublists, with pointer/range/alignment/cycle/overlap checks for synthetic inputs. Trusted framework traversal assumes the seventh export supplies readable framework pointers, as the existing copier does; this is not an arbitrary pointer validator. Handle equality is deliberately conservative and may refuse an otherwise compatible reconstructed handle. No final form is fed to the threshold-input copier.

Watchdog source is fail-closed while its reviewed packet hash remains an unset compile-packet sentinel. Only explicit `--run-reviewed-once` selects the future RUN branch; that flag is an operator instruction, never approval/Governance authority. RUN was never called, including through mocks. Pure tests exercise deadline/output precedence, mocked preflight refusal, acyclic-record validation, stable metadata and mocked helper-mode transitions. The eventual RUN implementation launches exactly one helper with fixed argv/environment/session, combines stdout/stderr, bounds captured bytes with a single overflow sentinel, uses a10-second monotonic deadline, kills only its created process group, allows one second to confirm reaping, and returns unknown for timeout/overflow/crash/file changes. No retry. Unreaped child is explicitly reported. The one-second reap confirmation is after the10-second observation deadline. The watchdog cannot bound synchronous framework work internally or guarantee Popen creation duration. No service/process discovery exists.

Pinned fixture was read only (metadata + bytes), never executed. Observed UID501, mode0600, size138024, Mach-O64 little-endian magic `cffaedfe`, SHA256 `d136d3f7d7c8135a543161afd4fa5127772bd1c35f41ed45cc37bf8d513e6f5e`. Full file identity is in the draft manifest. No chmod/sign/replacement/install occurred. **Test-only path/profile differs from canonical installation; no installed-path, code-identity exclusivity, custody or executing-issuer qualification follows.**

## Commands actually run

Working directory `/private/tmp/axiom-cssm-qualification-preparation-5fb1`:

```sh
clang -std=c11 -Wall -Wextra -Werror -Wno-deprecated-declarations -I packages/verified-issuer-runtime/native packages/verified-issuer-runtime/native/cssm_policy_copy.c packages/verified-issuer-runtime/native/cssm_policy_inspect.c packages/verified-issuer-runtime/native/cssm_policy_inspect_test.c -o /private/tmp/axiom-cssm-inspect-pure-test
/private/tmp/axiom-cssm-inspect-pure-test
nm -u /private/tmp/axiom-cssm-inspect-pure-test
python3 -m unittest discover -s packages/verified-issuer-runtime/native -p cssm_policy_watchdog_test.py
```

Results: pure inspector passes relocated application-only equality,18 malformed/mismatch refusals, node/range/count bounds. Original pure controller2 tests passed; round1 now has8 passing pure tests. `nm -u` lists only libc/compiler support: assert, stack probes/checks, memcpy/memset/bzero/memcmp/puts; no Security symbols/linkage. No full existing suites repeated. No honest TDD RED run was recorded before implementation; do not claim one. Source review must decide whether further pure negative testing is required.

## Required before compile or execution

Independent source review/freeze comes first. Root may then authorize compile-only linking already within preparation scope, record exact compiler/SDK/link and binary hashes, store helper mode0600 without loading, and update receipt. Draft manifest is intentionally not launchable and must be replaced with exact reviewed source/controller/helper/fixture bindings. After compilation, finalize a packet excluding the controller and the packet itself, then put its digest in the controller and externally bind that final controller hash plus packet digest in the reviewed execution instruction. This dependency order has no hash cycle. The future approved RUN branch already implements helper600→700→600 through its held descriptor: bind the initial600 metadata, observe700 ctime after chmod, verify immutable identity/hash fields, launch once, restore600 and observe final ctime. No future timestamp is predicted. Preparation has performed no helper chmod; the fixture always remains600 and never executes. No controller behavior rewrite is needed after approval; only the external receipt authorizes the reviewed concrete invocation. The manifest/source hashes are provenance only, not operational approval or grant inputs. An execution request still requires fresh explicit one-attempt authorization after the concrete compile packet exists.

Compile command proposed for review only, **NOT RUN**:

```sh
clang -std=c11 -Wall -Wextra -Werror -Wno-deprecated-declarations -DAX_CSSM_PROFILE=1 -I packages/verified-issuer-runtime/native packages/verified-issuer-runtime/native/cssm_policy_qualification.c packages/verified-issuer-runtime/native/cssm_policy_copy.c packages/verified-issuer-runtime/native/cssm_policy_inspect.c -framework Security -framework CoreFoundation -o /private/tmp/axiom-cssm-policy-artifacts/qualification-helper
chmod 600 /private/tmp/axiom-cssm-policy-artifacts/qualification-helper
```

No helper/controller --help, fixture execution, Security API, Keychain item call, provider/credentials/DB/external read/install/signing/service/root operation occurred.

## Frozen source hashes

| Source | SHA256 |
| --- | --- |
| `cssm_policy_builder.c` | `73b9b9e8683414608fd7ab2545d6a7342270ed6cf6e73627376d5d1989110f0a` |
| `cssm_policy_copy.c` | `e3bd87182c7f1c07e845618d46c6e6f0192a9591b0eb887bee753b59fd568dde` |
| `cssm_policy_copy.h` | `3aa8ace9335dbc63fb20aafec7ba717fb0dc76f13035c0b31efa1b6b1d0a1574` |
| `cssm_policy_copy_test.c` | `5be2a4dc5eba9d14607f08d92c6995933a64ae897bcc9ce23fc5a8375d9fb691` |
| `cssm_policy_inspect.c` | `bd4489741875db3522090ce54d741706eaedb4547c14cf246ed8f99c0b674ee9` |
| `cssm_policy_inspect.h` | `b0430cf1cfc4b24759d95b3f60f6dd7bf24c58585ff75a89c1b918e9e99c0902` |
| `cssm_policy_inspect_test.c` | `d121e6553b3afefcb5be79ed74ea1cc65967adac16c48af12091be4a9915bd90` |
| `cssm_policy_once.h` | `573d53fccd0fd6861c5da42d388c790166f10b864e3b2f9687f419ebbe133d88` |
| `cssm_policy_once_test.c` | `6cb5c1839b61afe16a378c07a4e2f8502ecb6a2ec9017937a4a464093499b387` |
| `cssm_policy_qualification.c` | `087fbe77b01d74997c892abd3c2337ffec8cfcfae634b22eb840ee170a791855` |
| `cssm_policy_qualification_receipt.h` | `8bab8b1f4fcbbf5e6b173d97fccd7ba1f68ea132c320a5322dfed29eb97818ac` |
| `cssm_policy_watchdog.py` | `c8c31248ececfc4a8c5a721527e1dfe1464c0b805efe48157a3bccf5756df630` |
| `cssm_policy_watchdog_test.py` | `e1652445e31d4a0151ea73afb412cf8b1707333188326fedfc962381d396627c` |

## Independent review fix round1 of5: acyclic packet/controller binding

Addressed P2: the previous draft put the controller hash into the packet while controller source embedded packet hash. The packet now rejects controller/self records. Finalization order is helper/source/fixture bindings → packet bytes/hash → controller packet-digest literal → external reviewed instruction containing the final controller hash and packet hash. Editing controller digest never changes packet bytes. The controller is protected by the independently reviewed external invocation receipt, not by a circular self-proof.

Actual RED command (before adding requested APIs):

```sh
python3 -m unittest discover -s packages/verified-issuer-runtime/native -p cssm_policy_watchdog_test.py
```

Result: `FAILED (errors=4)` across6 tests, missing `stable_stat`, `validate_records`, `mode_transition_matches`, `main`. After implementation the same command passed6 tests. Added fully mocked held-descriptor mode restoration success/exception tests, then the same command passed8 tests. No real filesystem mode change, helper/controller RUN, Popen, Security API or helper link occurred. Earlier missing inspector RED remains disclosed; it is not retroactively claimed. Inspector source/tests unchanged and not rerun in this round.

Stable identity comparison explicitly ignores atime, while comparing dev/inode/uid/gid/mode/linkcount/size/mtime/ctime within each read. Declared helper chmod transitions alone may change mode/ctime; every other recorded field must remain equal. Exceptional restoration preserves an outstanding owned PID in the unknown response. The mode transition tests patch all open/fstat/fchmod/close/binding calls and assert Popen never ran.

Concrete future invocation, **NOT RUN; not authorized by this document**:

```sh
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C HOME=/var/empty TMPDIR=/private/tmp /usr/bin/python3 /private/tmp/axiom-cssm-qualification-preparation-5fb1/packages/verified-issuer-runtime/native/cssm_policy_watchdog.py --run-reviewed-once
```

Before presenting the actual approval question, compile-only receipt must provide final packet digest and controller source SHA256, and the operator must verify them against that external receipt. The literal source/controller and exact helper/fixture binding must be those already independently reviewed. This source flag confers no execution authorization. Helper stays0600 throughout current preparation. No source behavior rewrite is required after execution approval.
