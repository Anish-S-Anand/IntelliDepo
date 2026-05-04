"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle theme"
      className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg transition-all theme-transition ${className}`}
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(0,0,0,0.12)",
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        color: isDark ? "#ffffff" : "#111827",
      }}
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[#F5A623]" />
          <span
            className="text-[10px] font-bold tracking-wider"
            style={{ color: "#ffffff" }}
          >
            LIGHT
          </span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[#374151]" />
          <span
            className="text-[10px] font-bold tracking-wider"
            style={{ color: "#111827" }}
          >
            DARK
          </span>
        </>
      )}
    </button>
  );
}
