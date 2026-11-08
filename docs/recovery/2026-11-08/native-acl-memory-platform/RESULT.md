# Memory-only macOS ACL qualification — result (2026-11-08)

**PASS**, limited to this host/toolchain's *synthetic in-memory* ACLs.

- Proposal: `governance-native-acl-platform-proposal/PROPOSAL.md` sha256 `09139ec5…` (user-approved; user confirmed running on this Mac and gave the runtime go-ahead in chat).
- Host: macOS 26.7.1 arm64, CLT `clang-2100.3.34.2`, SDK alias → `MacOSX27.0.sdk` (bound headers hash-identical). **Different host/toolchain from Codex's machine.**
- Production helper `protected_acl_empty.h` unchanged (`688fe24d…`).
- Independent source review: PASS, no blocking; one guard gap fixed pre-compile (N_INDR/N_PBUD rejected).
- Compile: 1 invocation, 2.494 s, exit 0, reaped. Binary `2b7413c7…`, map `1912d73a…`.
- Binary review (file-only): 17 ACL memory imports + `malloc/free/memcmp/memset/printf/puts/___stack_chk_*`; only `/usr/lib/libSystem.B.dylib`; no rpath. Post-compile guard amendment: `_memset` added (compiler zero-init; on prior accepted guard).
- Run: 1 invocation, 0.383 s, exit 0, reaped, empty stderr, stdout exactly:
  `PASS real in-memory ACL E0/E1/ED empty=1, explicit allow/deny=0, repeats and cleanup`
- Ledger in `observed/` (claims + terminals + logs). Both steps consumed; no retry authorized.

**Does not qualify:** ACL retrieval from any file/descriptor, effective authorization, filesystem ownership, journal durability, protected PG closure, installation, custody, executing identity, fleet, or Codex's host. Descendant quiescence unavailable. Six-role native proofs, the UID501 diagnostic and full Governance remain separate gates; A2/A7 and all 21 parents stay open.
