"use client";

import { useState, useEffect } from "react";
import { ChevronUpIcon } from "@heroicons/react/24/solid";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed bottom-4 right-4 z-[9997] flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 transition-all"
    >
      <ChevronUpIcon className="h-5 w-5" />
      Back to Top
    </button>
  );
}
