# Bounded implementation rulings

1. Ruling: pass a valid address of static unused CSSM_ACL_ENTRY_INFO storage with aclCount0 for the temporary owner-only builder, rather than NULL plus a nonnull-warning suppression. This preserves zero actual entries and the SDK nonnull ABI; storage lives for the process lifetime and is not installed as an entry. If the supported API behaves differently, real qualification must refuse; no actual invocation is authorized here. No rights or authority are added.

No original custody, copied-artifact, pre-main, compiled-consumer, fleet or coverage acceptance is waived. No actual policy/security operation was authorized by this implementation representation choice.
