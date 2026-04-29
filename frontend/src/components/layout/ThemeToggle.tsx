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
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all theme-transition ${className}`}
      style={{
        border: "1px solid var(--border-default)",
        backgroundColor: "var(--bg-input)",
        color: isDark ? "#F5A623" : "#374151",
      }}
    >
      {isDark
        ? <Sun className="w-3.5 h-3.5" />
        : <Moon className="w-3.5 h-3.5" />
      }
    </button>
  );
}
