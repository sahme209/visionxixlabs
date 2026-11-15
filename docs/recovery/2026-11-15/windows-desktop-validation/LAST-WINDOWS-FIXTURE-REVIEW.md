# Last Windows clone fixture correction

Head889389c: all9non-Windows checksPASS; Windows84PASS/1FAIL, job132884449995. The failure did not retain stderr. All corrected worktree, Node stream/cancellation/deadline and wire bound tests passed.

The remaining fixture passes a canonical Windows verbatim filename through GIT_CONFIG_GLOBAL. Pinned Git-for-Windows [config selection](https://github.com/git-for-windows/git/blob/v2.56.1.windows.1/config.c#L1453-L1463) copies that filename; [conditional read](https://github.com/git-for-windows/git/blob/v2.56.1.windows.1/config.c#L1503-L1510) checks access. Its [fopen implementation](https://github.com/git-for-windows/git/blob/v2.56.1.windows.1/compat/mingw.c#L986-L1012) validates Win32 paths before long-path conversion. This supports an inference, not observed historical attribution.

Normalize only the fixture global filename with the already-tested Git argument spelling helper. Probe both original and normalized paths informationally, then require the normalized marker equals true. Independently restrict both probes and clone to file transport. Git documents [GIT_ALLOW_PROTOCOL](https://git-scm.com/docs/git#Documentation/git.txt-GITALLOWPROTOCOL) as overriding protocol policy; the fixture cannot contact HTTPS even if its rewrite is broken. Preserve the actual clone and stored credential-free origin assertions. Redact Authorization/Basic payload and URL userinfo/password before bounding diagnostics to2048characters.

Independent release_batch_review actual-diff reviewCLEAR, no Important/Critical findings. Product code/credentials policy and all prior tests remain unchanged. No native run by reviewer. Ordinary tests cannot qualify this Rust fixture; require actual corrected Windows CI before normal merge.
