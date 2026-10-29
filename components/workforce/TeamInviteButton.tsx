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
      className="inline-flex h-8 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
    >
      <UserPlusIcon className="h-3.5 w-3.5" />
      Create invitation link
    </button>
  );
}
