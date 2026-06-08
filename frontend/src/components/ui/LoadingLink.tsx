"use client";

import { useLoading } from "@/contexts/LoadingContext";
import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface LoadingLinkProps extends Omit<LinkProps, 'onClick'> {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Enhanced Link component that shows loading indicator during navigation
 * Drop-in replacement for Next.js Link
 */
export function LoadingLink({ children, onClick, ...props }: LoadingLinkProps) {
  const { startLoading } = useLoading();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    if (onClick) {
      onClick(e);
    }

    // Only show loading if navigation will actually happen
    if (!e.defaultPrevented) {
      startLoading();
    }
  };

  return (
    <Link {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}
