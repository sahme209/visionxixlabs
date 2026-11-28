#!/bin/bash
# V19 organization settings for macOS. Run as root (for example as a Jamf policy script).
# Jamf parameters: $4 = managedBy (company name shown in Settings, optional)
#                  $5 = allowed workspace IDs, comma-separated (optional)
#                  $6 = update notices: "true" or "false" (optional, default true)
# Outside Jamf, pass the same three values as $1..$3. V19_POLICY_FILE overrides the target path (testing only).
set -euo pipefail
if [ -n "${4-}${5-}${6-}" ]; then MANAGED_BY="${4-}"; WORKSPACES="${5-}"; NOTICES="${6-}"; else MANAGED_BY="${1-}"; WORKSPACES="${2-}"; NOTICES="${3-}"; fi
TARGET="${V19_POLICY_FILE:-/Library/Application Support/VisionXIXLabs/V19/policy.json}"
fail() { echo "V19 policy: $1" >&2; exit 1; }
fields=()
if [ -n "$MANAGED_BY" ]; then
  [ "${#MANAGED_BY}" -le 80 ] || fail "managedBy must be 80 characters or fewer"
  case "$MANAGED_BY" in *'"'*|*'\'*) fail "managedBy cannot contain quotes or backslashes";; esac
  printf '%s' "$MANAGED_BY" | LC_ALL=C grep -q '[[:cntrl:]]' && fail "managedBy cannot contain control characters"
  fields+=("\"managedBy\": \"$MANAGED_BY\"")
fi
if [ -n "$WORKSPACES" ]; then
  ids=""; count=0
  IFS=',' read -r -a parts <<< "$WORKSPACES"
  for id in "${parts[@]}"; do
    id="$(printf '%s' "$id" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$id" ] && continue
    [[ "$id" =~ ^[A-Za-z0-9_-]{1,64}$ ]] || fail "workspace ID '$id' is not valid"
    ids="${ids:+$ids, }\"$id\""; count=$((count + 1))
  done
  [ "$count" -ge 1 ] && [ "$count" -le 50 ] || fail "give between 1 and 50 workspace IDs"
  fields+=("\"allowedWorkspaceIds\": [$ids]")
fi
case "$NOTICES" in "") ;; true|false) fields+=("\"updateNotices\": $NOTICES");; *) fail "update notices must be true or false";; esac
if [ -z "${fields[*]+x}" ]; then body=$'{}\n'; else body="{"; for i in "${!fields[@]}"; do body+=$'\n  '"${fields[$i]}"; [ "$i" -lt $((${#fields[@]} - 1)) ] && body+=","; done; body+=$'\n}\n'; fi
dir="$(dirname "$TARGET")"
mkdir -p "$dir"
tmp="$(mktemp "$dir/.policy.XXXXXX")"
printf '%s' "$body" > "$tmp"
if [ -z "${V19_POLICY_FILE-}" ]; then chown root:wheel "$tmp"; fi
chmod 644 "$tmp"
mv -f "$tmp" "$TARGET"
echo "V19 policy written to $TARGET"
