"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Track My Case consolidated with Status Decoder.
 * Redirects to /status-decoder for case status lookup and plain-language explanations.
 */
export default function TrackMyCasePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/status-decoder");
  }, [router]);
  return null;
}
