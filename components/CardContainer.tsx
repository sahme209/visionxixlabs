"use client";

import React from "react";

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CardContainer - Standardized container for all cards across the site
 * Ensures consistent max-width, centering, and horizontal padding
 */
export default function CardContainer({ children, className = "" }: CardContainerProps) {
  return (
    <div className={`w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 w-full min-w-0 ${className}`}>
      {children}
    </div>
  );
}
