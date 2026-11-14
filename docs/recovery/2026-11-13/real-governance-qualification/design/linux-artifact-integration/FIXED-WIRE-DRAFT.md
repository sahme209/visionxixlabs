# Fixed native capture wire and descriptor map — design draft

This resolves the previously unspecified byte framing and worker descriptor coordinates only. No implementation, real descriptor/clock/process call, native build/run or qualified time authority follows. Parent lifecycle/disruption/premise authority is still explicitly unresolved in REVIEW.md; this draft cannot make the full proposal implementation-ready.

## Versioned result

One result, EOF and successful owned-child reap are all required. Exact ASCII header lines:

```text
AXIOM_TIME_CAPTURE_V1\n
<device>\n
<inode>\n
<realtime_ns>\n
<p0_monotonic_ns>\n
<p1_monotonic_ns>\n
<p2_monotonic_ns>\n
<record_byte_length>\n
<exact record bytes; length above includes its own final LF>
END_CAPTURE\n
```

The notation above describes raw LF-delimited bytes, not literal backslash-n text, extra blank lines or a JSON string. Numeric lines are canonical unsigned decimal without sign, spaces or leading zeros except0. Device/inode are uint64; native timestamps are nonnegative signed63-range; byte length is1..4096. The record is the existing exact12-line AXIOM_TIME_V1 codec and supplies its own generation, publication and marker. No native struct, padding, FD number, pointer or host-endian integer is transmitted.

Envelope limit:4608bytes total, independently of the4096-byte publication limit. Longest header is at most153bytes (22-byte version line, six at-most21-byte numeric lines, five-byte maximum length line); trailer is12bytes. Thus maximum bounded payload is4261bytes, below4608. Reject a second frame, extra byte, missing trailer/EOF, truncation, noncanonical integer, malformed record, signaled/nonzero exit or output overflow. The worker cannot return an ExecutionTimeSource result or assert time_authority=1.

Parent decoding is tied to the original privately owned child/hold, not a frame-selected process/resource. Compare record bytes/generation/marker and captured file device/inode to that original hold and native observations; stdout matching alone is never provenance. Retain original R/P0/P1; later parent P2 cannot be supplied by a replayed worker response. No cached last-good output, alternate worker or retry.

## Candidate fixed child descriptor map

| Descriptor | Single permitted role |
| --- | --- |
|0|Noninteractive system sink input, no user data|
|1|Owned bounded result pipe only|
|2|Bounded fixed-category diagnostic pipe; never raw resource/secret dumps|
|3|Read-only protected generation directory descriptor|
|4|Read-only duplicate of the original parent-held publication descriptor|
|5|Private bounded bootstrap pipe for fixed generation/nonsecret native metadata|

Close bootstrap5 before capture; existing F_DUPFD_CLOEXEC minimum5 may then allocate its worker-owned source duplicate. Native capture_release closes only that duplicate; parent retains its original descriptor independently until final native currentness/P2 and quiescent release. Close every other inherited descriptor before the fixed executable begins. The exact Linux implementation must establish close/spawn/exec ordering and no late unowned child under cancellation.

No executable/path/UID/profile/source is selected by request JSON, argv or environment. The protected initializer must bind the actual artifact and pass only its owned resources. A descriptor map does not prove process isolation, directory ownership, denied access to /proc or ambient credentials/network; those remain real profile and negative-test requirements. No provisioning, access grant or host setting is authorized here.

## Ordinary tests after exact implementation approval

Exercise the real parser on exact maximum length, every malformed numeric/header/trailer/extra-byte case, original hold mismatch and record status refusal. Native source must generate the same format; later compile/run must test actual EOF/reap/close/cancellation behavior. Do not create a test-owned simulated loop and report it as native process behavior.
