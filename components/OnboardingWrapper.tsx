"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TopNavigation from "./TopNavigation";

export default function OnboardingWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // No step-by-step onboarding redirect—users go straight to the page they requested.
  // If signed in with no profile, the home page redirects to profile-setup.
  const isOnboardingPage = pathname === "/onboarding";

  if (isOnboardingPage || !mounted) {
    return <>{children}</>;
  }

  return <TopNavigation>{children}</TopNavigation>;
}

