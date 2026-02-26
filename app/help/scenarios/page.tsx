"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Timeline Scenarios consolidated with Process Timelines.
 * Redirects to /help/timelines.
 */
export default function TimelineScenariosPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/help/timelines");
  }, [router]);
  return null;
}
