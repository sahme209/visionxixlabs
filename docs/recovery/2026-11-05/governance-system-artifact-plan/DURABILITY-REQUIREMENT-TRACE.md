# Startup durability requirement trace and concrete barrier gap

## Original requirement, not an invented universal guarantee

The reviewed xpc-controlled-origin/contract.md requires broker crash/restart and second initialization to refuse, binds authority to the actual owned child and rejects revival from serialized state. canonical-integrated-next-unit.md retains permanent claims, unknown history and no automatic replay. private-effect-service-proposal.md preserves consumed unknown outcomes when provider acceptance is possible. None specifies immunity to arbitrary hardware corruption or a universal storage guarantee. Those stronger claims must not be added or advertised.

The actual origin_broker.c authenticates the received start message before prepare_start, which calls claim_startup before root binding or any child spawn. Current claim_startup writes the exclusive-create record then calls fsync. Its same-UID deletability remains a separate unresolved issue. No source change or positive runtime qualification follows from this audit.

## Installed platform text changes the next design

The installed fsync(2) manual explicitly warns that host flush may leave none/some data persistent after OS crash or drive power loss. Its recommended stronger barrier is fcntl F_FULLFSYNC. The installed fcntl(2) manual describes supported HFS/FAT/UDF/APFS implementations, persistence ordering after successful return, potentially long execution and known devices that ignore flush requests. Exact manual hashes are in durability-reference-bindings.json; no new external read or platform operation occurred.

Therefore the append candidate's fsync-only success condition is insufficient. A revised candidate must use the documented full barrier before allowing ANY child spawn/resource delivery, retain nonblocking admission locks and late-job refusal, and refuse unsupported/error/unknown barriers with no fallback to fsync alone. It cannot guarantee prompt kernel return; existing suspended-spawn/cancellation handling remains necessary. Supported storage and actual operator/installation protection still need qualification.

## Remaining separation

A process killed before a successful durable barrier cannot have spawned through this source path. That limits potential effects; it does not prove that a later empty record has no prior attempt. The stricter permanent-startup/restart requirement therefore remains unresolved unless the generation's trusted launch history independently denies such reuse. Do not reinterpret empty as pristine after uncertain history, relax the original restart policy, or let successful F_FULLFSYNC become authority by itself.

Next design must compose the root-protected monotonic state, full barrier and trusted generation/launch history. It must not silently expand an installer into a live root service. No new implementation/experiment/privileged-write permission is inferred. The runtime Node compatibility milestone does not resolve this boundary. All original master requirements stay open.
