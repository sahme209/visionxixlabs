# Outlook local-time normalization correction

Date(start/end).toISOString silently normalized America/New_York spring-gap2027-03-14T02:30 into03:30local/07:30Z. Actual rendered tests reproduced invalid start and end being saved instead of refused: RED2failed/1validcasepassed. The new helper validates local syntax, finite Date and exact local-component roundtrip before UTC conversion. Component changes only one import and two conversions; the receipt records the root whole-file reconstruction check. No provider/approval/transport/retry change.

GREEN3rendered cases then final19focused checks passed:16new-file cases plus2prior lock and1disclosure case. Full desktop noEmit TypeScript passed. Logs/results/command coordinates are preserved. Tests used simulated transport/context and fixed child TZAmerica/New_York, not system timezone changes or actual Outlook. Existing unrelated suites were not repeated; no full-suite claim. Source-only, not embedded in signed916app or deployed. Independent review found no important issue within the stated scope.

Valid UTC and seconds/milliseconds are preserved; invalid calendar dates, nonexistent local times and non-local syntax refuse. Fall-back overlapping times intentionally retain Date's existing choice; no disambiguation claim. Native input behavior, timezone changes during editing and actual provider acceptance remain open.

## Interrupted evidence preservation

The intentional turn interruption cleared the owned temporary directory before its exact raw config/profile could be copied into this receipt folder. The logs/results and source hashes remain durable; coordinates refer to a now-missing directory. Do not claim retained raw configuration/profile bytes or a replayable environment. None was reconstructed or substituted as historical evidence, and no passing test was automatically rerun. During final receipt saving that missing-file copy stopped the first documentation script after receipt.json; source/tests/logs were committed as98326226 before this explicit documentation correction.

New CUA access returned invalid for the former temporaryapp path, and inventory/ps showed no runningAxiompreview. No fallback/relaunch or permission action was attempted; this does not identify why the process ended. The unsigned and signed recovery archives are separate durable artifacts. Future delivery should reconstruct a verified persistent app rather than rely on an expired temporary path.
