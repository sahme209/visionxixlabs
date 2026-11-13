# Reproduced post-merge native stream test deadline

GitHub main job131888564646 on3976f399 failed `http::stream_wire_tests::real_wire_bounds_total_bytes_and_each_ipc_chunk`: full permitted stream deadline Elapsed at line218.95other tests passed,1ignored. The same exact test passed on the reviewed PR. This is a captured failure; no blind CI rerun was requested.

The fixture reparses8MiB of JSON byte arrays into one generic serde_json::Value per byte while measuring a five-second wall deadline. A proposed test-only correction decodes each actual Tauri serialized chunk directly into Vec<u8>/u64, removing unnecessary Value allocations. It retains real TCP/reqwest/Channel,8MiB+one excess byte,16KiB IPC bound, one outstanding acknowledgment, total delivered equality, refusal, and the identical five-second deadlines. Product transport/source is unchanged. Reduced test allocation is source-observed; its effect on the intermittent timeout remains unproven until CI runs.

One local offline reproduction attempt stopped before compilation because the cached crates.io index lacks quinn for locked reqwest0.13.5. No dependency install, lock edit, network fetch or passing Rust test is claimed. Exact PR CI and independent source review must validate this correction; do not mark main green or weaken timing/assertions.

Same independent source reviewer found no important issue: typed byte-range validation is stricter; all bounds/acknowledgments and five-second deadlines remain. Source review only, no compiled-Rust result or measured performance improvement claimed.
