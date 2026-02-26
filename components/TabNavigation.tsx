"use client";

import { usePathname, useRouter } from "next/navigation";
import { HomeIcon } from "@heroicons/react/24/solid";
import { BookOpenIcon } from "@heroicons/react/24/solid";
import { ChartBarIcon } from "@heroicons/react/24/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";

interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const tabs: TabItem[] = [
  { id: "home", label: "Home", icon: HomeIcon, path: "/" },
  { id: "guides", label: "Guides", icon: BookOpenIcon, path: "/guides" },
  { id: "stats", label: "Stats", icon: ChartBarIcon, path: "/stats" },
  { id: "help", label: "Help Center", icon: QuestionMarkCircleIcon, path: "/help" },
  { id: "settings", label: "Settings", icon: Cog6ToothIcon, path: "/settings" },
];

export default function TabNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Hide tabs on login page
  const shouldShowTabs = pathname !== "/login";

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${shouldShowTabs ? "pb-20" : ""}`}>
        {children}
      </main>

      {/* Tab Bar - Only show on main app pages - Sleek & Professional */}
      {shouldShowTabs && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--uscis-blue-dark)] via-[var(--uscis-blue-dark)] to-[var(--uscis-blue)] border-t-2 border-[var(--uscis-blue)]/30 backdrop-blur-2xl bg-opacity-98 shadow-[0_-8px_32px_rgba(11,61,145,0.4)] z-50">
          <div className="flex justify-around items-center h-16 max-w-md mx-auto px-3 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.path;

              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.path)}
                  className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) group ${
                    isActive ? "text-white" : "text-white/75 hover:text-white/95"
                  }`}
                >
                  {/* Active indicator background - Sleeker */}
                  {isActive && (
                    <div className="absolute inset-x-3 top-2 bottom-2 bg-white/25 rounded-xl backdrop-blur-md animate-fade-in shadow-lg" />
                  )}
                  
                  {/* Icon with smooth scale animation */}
                  <div className="relative z-10">
                    <Icon
                      className={`w-6 h-6 transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${
                        isActive 
                          ? "scale-115 text-white drop-shadow-xl" 
                          : "scale-100 text-white/75 group-hover:scale-110 group-hover:text-white/95"
                      }`}
                    />
                  </div>
                  
                  {/* Label with smooth font weight transition */}
                  <span
                    className={`relative z-10 text-xs mt-1.5 transition-all duration-300 ${
                      isActive 
                        ? "font-bold text-white" 
                        : "font-medium text-white/75 group-hover:font-semibold"
                    }`}
                  >
                    {tab.label}
                  </span>
                  
                  {/* Subtle pulse effect for active tab */}
                  {isActive && (
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-lg" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

