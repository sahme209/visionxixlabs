"use client";

import { signOut } from "next-auth/react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
    >
      <ArrowRightOnRectangleIcon className="h-4 w-4" />
      Sign out
    </button>
  );
}
