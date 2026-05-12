"use client";

import { signOut } from "next-auth/react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="btn-huly inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-violet-400 transition-colors"
    >
      <ArrowRightOnRectangleIcon className="h-4 w-4" />
      Sign out
    </button>
  );
}
