"use client";

import Link from "next/link";
import { BACK_TO_HELP_CENTER } from "@/lib/constants/copy";

const linkClass =
  "text-sm font-medium text-[var(--text-primary)] hover:underline inline-flex items-center gap-1";

export default function BackToHelpCenterLink({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Link href="/help" className={className || linkClass}>
      {BACK_TO_HELP_CENTER}
    </Link>
  );
}
