"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export default function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage only - prioritize website theme over system preference
    const stored = localStorage.getItem("theme");
    // Default to light mode if no preference is stored
    const isDark = stored === "dark";
    setDarkMode(isDark);
    // Ensure theme is set in localStorage if not present
    if (!stored) {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
    } else {
      updateTheme(isDark);
    }
  }, []);

  const updateTheme = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    updateTheme(newMode);
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors"
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <SunIcon className="w-5 h-5 text-white" />
      ) : (
        <MoonIcon className="w-5 h-5 text-white" />
      )}
    </button>
  );
}

