# Independent review — compiler network-denial design research scope

Verdict: CLEAR for the finite THREE-page public-contract read plus DESIGN PREPARATION request only. No implementation, compiler, syscall/filter/probe, CI retry, dependency acquisition, settings or spending follows.

The request correctly preserves the consumed PR331 attempt and observed uid_map EPERM as an isolation-preflight failure, not a compile/network/dependency result. It selects one concrete candidate mechanism: a minimal fixed C launcher using installed Linux UAPI declarations, no-new-privileges and an inherited seccomp filter, with unsupported/error refusal before exec. This avoids guessed ctypes layout/constants and another kernel-file traversal without pretending installed headers prove kernel support.

The three named primary contract pages address installation/inheritance, ABI/architecture hazards and the irreversible privilege prerequisite. They are a coherent bounded evidence pass, not proof that every possible bypass has been exhaustively ruled out. If they cannot support a proposed rule or limitation, the design must report that gap and stop; no fourth read, policy relaxation or fallback is automatically authorized.

The scope appropriately retains exact x86_64/x32 handling, socket/socketpair denial, io_uring and cross-process descriptor/state concerns, clean inherited descriptors/environment, supervised process ownership, finite deadlines and no hostile-code/full-filesystem-containment claim. Existing sockets or descriptor acquisition cannot be waved through as harmless merely because connect is denied. Registry fetch is the sole permitted networking phase; subsequent actual source/dependency compiler tools remain restricted.

For the later exact execution proposal, distinguish compiling the small trusted launcher before the restricted phase from executing downloaded build scripts or compilers under it. Bind its source/compiler/UAPI headers, exact filter instruction program and actual benign restriction preflight; perform that preflight before registry acquisition. Current request already holds those actions for a fresh conditional one-attempt decision. No sudo, user namespace/sysctl/root/service/package-install workaround is introduced.

No important scope or permission contradiction found. This review did not execute any target/compiler/filter, query a kernel/account/provider, or read any external page; it inspected only the saved request and wrote this review.
