# Desktop approval queue recovery

A queued vote added while the retry pass awaited the service could be discarded when the old snapshot replaced the live queue. Two ambient retry callers could also send the same queued vote concurrently. Regression tests reproduced both failures before the fix.

The queue now shares one in-flight drain, merges only the attempted snapshot identities into the current queue, and uses random UUIDs to distinguish same-millisecond entries. It preserves new entries, transient-failure backoff and the existing maximum queue depth. Five tests passed, including recovery after an unexpected client rejection. Server authorization and approval requirements remain authoritative.

This covers runtime queue races with mocked client/storage. It does not prove native offline/restart acceptance, persisted queue identity binding across account changes, or server voter provenance. Those require their own checks.
