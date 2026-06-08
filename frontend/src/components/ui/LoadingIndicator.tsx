"use client";

import React from "react";
import { useLoading } from "@/contexts/LoadingContext";

export function LoadingIndicator() {
  const { loading } = useLoading();

  // Don't render anything when not loading
  if (!loading) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Enhanced Spinner: Larger, more visible with pulsing effect */}
        <div className="relative">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full opacity-40 animate-ping"
            style={{
              width: '96px',
              height: '96px',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, transparent 70%)',
            }}
          />
          
          {/* Main spinner */}
          <div
            className="relative rounded-full border-8 animate-spin"
            style={{
              width: '80px',
              height: '80px',
              borderColor: 'rgba(148, 163, 184, 0.3)',
              borderTopColor: '#3b82f6',
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
            }}
            aria-hidden="true"
          />
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-1">Loading</p>
          <div className="flex gap-1 justify-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>

        {/* Screen reader text */}
        <span className="sr-only">Loading, please wait</span>
      </div>
    </div>
  );
}
