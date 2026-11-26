import { useEffect, useState } from "react";

/**
 * Motion runs only where the platform can report the user's preference and it is not "reduce".
 * Without matchMedia (tests, very old engines) the UI renders its final state immediately.
 */
export function allowMotionNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAllowMotion(): boolean {
  const [allowed, setAllowed] = useState(allowMotionNow);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowed(!query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return allowed;
}
