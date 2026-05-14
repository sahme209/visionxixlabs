#!/usr/bin/env bash
# Set Google + GitHub OAuth credentials on Vercel for the linked project,
# then trigger a redeploy so the change is picked up.
#
# Usage:
#   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… \
#   GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… \
#   ./scripts/setup-oauth.sh
#
# Skips any provider whose env vars aren't supplied — partial config is OK.

set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "✗ vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi

push_var() {
  local NAME="$1"
  local VALUE="$2"
  for ENV in production preview development; do
    # Remove any existing value silently before adding the new one.
    vercel env rm "$NAME" "$ENV" --yes >/dev/null 2>&1 || true
    printf "%s" "$VALUE" | vercel env add "$NAME" "$ENV" >/dev/null
    echo "  ✓ $NAME → $ENV"
  done
}

did_anything=false

if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "Configuring Google OAuth on Vercel…"
  push_var GOOGLE_CLIENT_ID     "$GOOGLE_CLIENT_ID"
  push_var GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
  did_anything=true
fi

if [[ -n "${GITHUB_CLIENT_ID:-}" && -n "${GITHUB_CLIENT_SECRET:-}" ]]; then
  echo "Configuring GitHub OAuth on Vercel…"
  push_var GITHUB_CLIENT_ID     "$GITHUB_CLIENT_ID"
  push_var GITHUB_CLIENT_SECRET "$GITHUB_CLIENT_SECRET"
  did_anything=true
fi

if [[ "$did_anything" = false ]]; then
  echo "Nothing to do — supply at least one provider's env vars." >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… $0" >&2
  exit 1
fi

echo ""
echo "Triggering a production redeploy…"
vercel --prod --yes
echo ""
echo "✓ Done. Hit https://visionxixlabs.com/auth/signin — the configured OAuth buttons are now live."
