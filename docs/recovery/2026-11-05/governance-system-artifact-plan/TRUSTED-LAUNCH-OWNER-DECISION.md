# Decision: specify a fixed trusted launch owner — no implementation authority

## Why this decision is necessary

The reviewed installation writer is already explicitly trusted, but it was approved only to provision fixed synthetic items. Turning it into a running privileged launch guardian is NOT covered. The non-root broker's current-user startup claim is resettable by another same-UID process. The append-only candidate still lacks accepted unknown-generation history. More Node smoke tests cannot resolve either issue.

## Proposed changed architecture for specification review

Retain the existing dedicated non-root custodian and private consumer. Add a separate minimal native trusted administrative launch owner whose only effect is one fixed generation-bound non-root broker launch. It receives no customer/provider secret and exposes no generic command, file writer, caller executable/argv/environment/UID selector, arbitrary signing request or permission grant. It is not the Agent and does not execute user tasks. Its root privilege and lifetime are a new trust boundary, openly acknowledged.

Only a separately authorized operator may install/arm a fresh protected generation. The owner exclusively records consumed/unknown state in a distinct root-only launch journal and obtains the qualified full persistence barrier BEFORE any child launch. Every existing/nonterminal/unknown journal denies startup; no resume, adoption, clear, cleanup or automatic restart. Do not extend/reinterpret the already reviewed provisioning journal format or reuse old claims. Root/admin remains explicitly trusted; hardware/storage support and operator handling of ambiguous failure must be stated, not replaced by universal durability promises.

A running owner must bind its actual one non-root broker child and remain responsible for its lifetime. Broker qualification must authenticate the actual owner and prove it is that owner's child, preserving per-message code identity and exact generation. PID/parent-PID, path, JSON, signature metadata or a record alone are insufficient. Existing native actual-message+owned-child techniques may be reused only after a complete supported topology is specified. No new IPC or origin token is selected by this decision. Owner loss revokes before resource/claim/send; unknown child cleanup remains denial. No caller can request a replacement launch.

The existing broker still owns the one suspended private Node child and exact native initialization; original pre-main/current-authority/claims/credential/final-send/fleet gates remain. The owner cannot mint approval, grant provider authority or enable Governance. No new resource read belongs in the privileged owner.

## What the requested design decision permits

Specify the exact root/non-root lifecycle, fixed install/service layout, supported privilege-drop and authenticated-message interfaces, separate journal state machine and qualified storage model, allowed launch/cleanup transitions, denial/upgrade/revocation behavior and adversarial acceptance matrix. Inspect existing source/local SDK text only. Reuse current source mechanisms where support is established; explicitly reject missing mechanisms. Produce a concrete implementation review, not a positive gate.

This decision does NOT authorize code, compilation/signing/execution, root/account/role/grant changes, service registration, Keychain/credential access, filesystem flags/ACL changes, actual provisioning/launch/restriction experiments, network/provider actions, installation, deployment or spending. All master A/B/C requirements remain binding. If this architecture cannot preserve them, it must be rejected rather than activated.
