#!/usr/bin/env bash
# Retired administrative entrypoint. Use the separately qualified managed
# settings workflow, with exact target/environments and independent review.
# Existing-setting updates remain held. Never silently remove/add a value or
# redeploy after a settings change. Original source remains in Git history.
printf '%s\n' 'Axiom managed settings review is required. This legacy OAuth setup script is retired; no settings or deployment were changed.' >&2
exit 1
