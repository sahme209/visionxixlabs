# Fixed PostgreSQL socket pathname exceeds platform structure capacity

Source/installed-header evidence only. No PostgreSQL, socket, native/helper, host API, installation or network operation was executed.

The selected directory is:

`/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/c3b7bf334ce56a64575183b7a66e5109/fixture/socket`

Its UTF-8 length is **130 bytes**. With the ordinary default-port PostgreSQL socket filename `/.s.PGSQL.5432`, the pathname is **144 bytes**. The directory alone already exceeds the entire104-byte `sockaddr_un.sun_path` field declared by the installed SDK header `/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/un.h`, line79. This is a source/ABI incompatibility finding, not an observed failed PostgreSQL launch; no such launch was attempted. Changing port cannot make the130-byte directory fit.

Current affected source bindings and exact matching lines/hashes are preserved in `socket-path-bindings.json`:

- `lib/governance/qualification/privateSyntheticFixtureProducer.ts`: line11 constructs SOCKET; URI uses it, and inspect line23 requires exact server unix_socket_directories equality.
- `packages/verified-issuer-runtime/native/synthetic_fixture_producer.c`: line76 constructs the runtime datasource with this same fixed directory.
- `lib/governance/qualification/privateFixtureSchedule.ts`: line10 requires exact server socket-directory equality.

A server-only shorter path or symlink/config substitution would violate those existing equality checks and the protected-coordinate intent. The smallest correction design should select one short literal protected Unix-socket directory and preserve generation binding, root-controlled nonwritable ancestry, no aliases, appropriate socket/server ownership and the existing no-TCP/HBA/ident/privacy contracts across all three consumers. Inventory affected tests, native compile inputs, fixture producer emission and downstream artifact provenance before implementation; no code or replacement artifact is authorized by this finding. Existing long paths for HBA/ident/data files need not change merely because the Unix socket path is short.

The accepted static signatures and image/build/seal receipts remain valid evidence for their exact historical bytes. They never established runtime compatibility; preserve them as unqualified artifacts rather than rewriting or rerunning them. This finding blocks assuming that current bytes can pass the proposed PostgreSQL-backed operational qualification; it does not invalidate their completed static checks or demand a new signing attempt by itself.
