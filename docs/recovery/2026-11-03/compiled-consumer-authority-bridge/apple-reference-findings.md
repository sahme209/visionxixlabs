# Bounded Apple reference reads — findings and limits

November 3, 2026. User separately approved four official Apple documentation pages and four official Apple public source files. Both exceptions are consumed. Documentation approval: `call_1CWgmZBBYT9aqs0KGygS2YJf[0]`; source approval: `call_9q7e12Bdfc86KZXygn4UYMG8[0]`. These identifiers record read provenance, not runtime authority. Source text was read in memory only: no repository clone, source file download to disk, compilation, execution, IPC, entitlement, credential, provider mutation or deployment. A candidate `KernelCode.cpp` path returned404; the actual implementation is `cskernel.cpp`. Four valid source files were inspected. Alternate HTML/Markdown/raw representations did not add documents/files.

## Documentation findings

1. [Apple DTS: dynamic code references](https://developer.apple.com/forums/thread/825834) distinguishes live `SecCode` from static references; C wrappers avoid Swift conversion difficulties. It does not establish caller JavaScript identity.
2. [Apple DTS: credential-passing boundaries](https://developer.apple.com/forums/thread/799002) explains that host-process signatures do not identify individual in-process plug-ins. This supports a process boundary, not an inference that a Node signature authenticates its scripts.
3. [SecCodeCopyGuestWithAttributes](https://developer.apple.com/documentation/security/seccodecopyguestwithattributes(_:_:_:_:)) permits kernel-host guest lookup and reports unsupported or ambiguous attributes. This page did not specify the audit-value representation.
4. [es_process_t](https://developer.apple.com/documentation/endpointsecurity/es_process_t) describes event-time process/signing observations and warns that validity does not establish validation of every executable page. Reading it authorizes no Endpoint Security extension or entitlement.

The web reader returned JavaScript shells for the two API references and could not parse their linked Markdown type. The same two official Markdown representations were therefore read directly in memory. Their SHA-256 values were `a06e2b5a178ff617655dd844fd27efa3b5e6043db62390253402609b3d67ea6d` and `1fa7203b7a1aa317858869d25212e84b3028a58227b37a0140df129734cfea30`, respectively.

## Public implementation findings

| Official source snapshot | Observed fact | SHA-256 |
|---|---|---|
| [Security/SecCode.cpp](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_codesigning/lib/SecCode.cpp),208–209 | Audit bytes are wrapped as CFData of `sizeof(audit_token_t)`. | `e66a8e915c9919f0ee07b67d70d5a3a92b3cc3bb0a0ee875ec9b773b680b9854` |
| [Security/cskernel.cpp](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_codesigning/lib/cskernel.cpp),81–113 | Guest lookup checks audit-data size and passes that token into its process-code object. | `caa29bbc4711f2739ff6a86a68358d38ff7a5d851132fd44b91463353f0baa3b` |
| [XNU/kern_exec.c](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_exec.c),7096–7105 | The inspected exec path changes process identity version and updates task identity. | `89531d33618b8361064236189212c3c96be1b32e098690b17802b6b15d932d1a` |
| [XNU/kern_proc.c](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_proc.c),3587–3600 | The inspected kernel path rejects an audit PID/version mismatch with the current process. | `34f745a213769ffa47b4edace6e3e158f654075def1b0fe50edf97f9bf53589d` |

These are observed `main` snapshots, not pinned deployed-OS evidence or guarantees for every OS version. They support selecting the representation and process-instance checks for a reviewed public-API candidate; they do not complete its actual qualification. Axiom must use supported public APIs, not call private functions seen inside Apple's implementation.

## Required boundary remains

The actual compiled Node process owns business policy, Prisma, claim/lease handling, signing/decryption, minting and final transport. Native supervision/provisioning must authenticate its real owned instance; a sender filter alone does not establish the compiled call or authorize a secret grant. Private initialization, resource exclusivity, the original same-compiled-consumer matrix and permitted validation route remain outstanding. The automatically blocked test-generation case is not recreated, replaced or waived by this research. Issuer readers and activation remain unavailable.
