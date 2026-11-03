# Installed public running-peer authentication contracts

Design-review input only. Installed SDK headers/man pages, no network, API execution, other-PID lookup, mount, initializer, new profile, grant or native experiment. The earlier NoWrite failure remains intact. Original trusted-localhost scope is not enlarged to hostile-host, network or universal-process guarantees.

## What is actually supported

- Security.framework `SecCodeCopyGuestWithAttributes` (SecCode.h135–189) obtains a dynamic running-code reference using system-root procedures with a NULL host; PID and audit selector constants are public (123–129). Unsupported attributes, invalid values and ambiguous guests return errors. Do not silently retry with a weaker selector. The installed header declares the audit selector but does not document its value CFType/encoding; correct construction/support must be resolved rather than invented from a typedef.
- `SecCodeCheckValidity` (217–237) dynamically checks the signature components needed for identity, dynamic host validity and an optional explicit requirement. The header explicitly states this validation is secure against attempts to modify the code's filesystem source. A validated exact fixed broker can therefore be distinguished from an arbitrary same-UID program; checking only its path, executable filename or source-file hash is not equivalent.
- `SecCodeCopySigningInformation` (332–357) is not validation: unsigned code can succeed and invalid signatures can yield partial data. First validate the dynamic code, then inspect appropriately typed exact signing identity. `kSecCodeInfoUnique` (455–466) identifies the specific static signed code, unlike a stable identifier across updates. Dynamic status (437–440) is explicitly a snapshot, possibly stale. Ad-hoc signatures carry no certificate chain/CMS/date proof (372–374,443–448); an ad-hoc identifier alone authenticates no publisher. A trusted immutable expected identity/requirement must come from verified code/package, never parent JSON/env or a caller-selected source hash.
- `SecCodeCopyStaticCode` (66–94) explicitly says the running-code→filesystem-origin link is NOT guaranteed secure. Its output or a parent executable path is not a replacement for dynamic identity validation. `SecCodeCopyHost` (101–119) securely reports the code-signing host hierarchy, but that is not documented as the UNIX parent/spawn relationship; do not equate the two.
- `sys/un.h88–93` exposes LOCAL_PEERCRED, LOCAL_PEERPID and LOCAL_PEERTOKEN. The installed unix(4) man page152–179 describes reliable peer UID/group credentials captured at connect/listen; it does not give a per-message current-image guarantee. LOCAL_PEERTOKEN is declared as peer audit token, but its exact caching/exec/descriptor-forwarding semantics are not specified there. Existing fresh post-exec socket design must retain those as knockout checks, not claim an invented property. `bsm/libbsm.h1538–1578` provides public audit-token PID and PID-version extraction; do not parse private token words. Raw PID alone is insufficient: xpc/connection.h671–678 explicitly warns about PID recycling and delayed peer-death notification.

## Stronger public XPC alternative, with a concrete setup limit

`SecCodeCreateWithXPCMessage` (SecCode.h193–214) explicitly derives a dynamic sender reference from the actual received XPC message's associated audit token. `xpc_connection_set_peer_code_signing_requirement` (connection.h772–803, macOS12+) checks **all received messages**, drops mismatching listener requests and reports requirement errors for expected replies. This is a documented stronger message-binding contract than a one-time PID lookup. Exact fixed revision requirements still need trusted provenance; matching a publisher/team is not matching the exact broker artifact. The newer team-identity helper additionally has specific signing-origin requirements; do not silently use it for ad-hoc code.

No new persistent or privileged service installation is necessary to create an anonymous listener: `xpc_connection_create(NULL,...)` (136–139), `xpc_endpoint_create` (endpoint.h7–22), and `xpc_connection_create_from_endpoint` (209–228) are public. An anonymous endpoint is not rediscoverable and listener death invalidates its connection. However the documented endpoint transfer is via an existing XPC message. These headers do not supply a ready initial anonymous endpoint handoff over the proposed raw UNIX socket across exec. Keep this as an alternative requiring a concrete transport design; do not silently introduce launchd registration, privileged services or endpoint possession as identity.

## What identity does not prove / design implications

Authenticating the actual running fixed broker is feasible in principle with these public contracts; **none attests that a historical NoWrite initializer ran or remains effective**. That requires the exact broker/bootstrap's reviewed control flow and separately authorized native acceptance. A genuine but unrelated instance of the same signed binary must not be able to bless arbitrary runtime processes.

The fixed broker protocol therefore needs to bind a fresh one-use launch challenge to the actual child it created, exact current peer token/process identity, immutable package identity, direct bootstrap→same-child-exec state and supported success/failure observations. It must refuse unrecognized children, caller-supplied provenance, replay, broker death/exec change, stale or mismatched identity and ambiguous API results. A challenge alone is not provenance; a peer-authenticated response on a currently bound channel is necessary. Inherited socket/endpoint possession can transport setup data but cannot itself serve as NoWrite/launcher attestation. Channel forwarding and exec races must be resolved in the specific owned flow, not assumed away by a PID equality test or demanded as universal hostile-host proof.

No positive executing digest, capability receipt, NoWrite guarantee, enrollment, deployment or activation is established by this review. The native author retains ownership of the proposed bootstrap mechanism and any future approved own-process fixtures.

## Installed SDK hashes

SDK /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk:

- Security.framework/Headers/SecCode.h: 47a0cf42f3babd16f5f8523464f9895cc2302650c35e401e1d9923d6c30769db
- usr/include/xpc/connection.h: fee99c719a44ff57f5f3bd9e3e2d2b5518d093a476c0df9d4fbcc6a358750d51
- usr/include/xpc/endpoint.h: 360df5662cbc16a7ff5628a2472f2f58a4f509621035068226a1ba5e22c32499
- usr/include/sys/un.h: a733cb89955ef81312f4bc3a42002c6cc873e27381eb43656c7158ef9a433c24
- usr/include/bsm/libbsm.h: 103f140eeeb89cfe35f0f5b8f6c5dd27e53d01c2ae13e82514777c2e6f33de2b
