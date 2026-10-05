"use client";

/**
 * RouteAnnouncer — announces client-side route changes to screen
 * readers. Next.js App Router navigation doesn't trigger a full page
 * load, so a screen-reader user who activates a link gets no
 * announcement at all that the page changed — focus stays wherever it
 * was, and nothing reads out the new page title. This is a known App
 * Router accessibility gap; this component is the standard fix used by
 * other React routers (Gatsby, Reach Router): an aria-live region that
 * announces `document.title` shortly after each navigation, once the
 * new page's <title> has committed.
 *
 * Mounted once at the root layout so it covers every route, including
 * the dashboard.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Next's <title> updates asynchronously after navigation; a short
    // delay avoids announcing the previous page's stale title.
    const id = setTimeout(() => setMessage(document.title), 100);
    return () => clearTimeout(id);
  }, [pathname]);

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
