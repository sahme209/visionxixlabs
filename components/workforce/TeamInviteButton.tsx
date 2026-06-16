/**
 * TeamInviteButton — Phase 639.
 *
 * Simple submit button for the team-invite form. Server returns a
 * 303 redirect with notice=invite_sent and the URL in the query
 * string. The parent page surfaces a success banner from the
 * notice query param.
 */

"use client";

import { UserPlusIcon } from "@heroicons/react/24/outline";

export function TeamInviteButton() {
  return (
    <button
      type="submit"
      className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors inline-flex items-center gap-1.5"
    >
      <UserPlusIcon className="h-3.5 w-3.5" />
      mint invite →
    </button>
  );
}
