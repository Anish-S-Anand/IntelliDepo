"use client";

import { ChevronDown } from "lucide-react";

export interface LocationFilterProps {
  value: "combined" | "WH_HYD" | "WH_BLR";
  onChange: (value: "combined" | "WH_HYD" | "WH_BLR") => void;
  disabled?: boolean;
}

type FilterOption = {
  value: "combined" | "WH_HYD" | "WH_BLR";
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "combined", label: "Hyderabad and Bengaluru (Combined)" },
  { value: "WH_HYD", label: "Hyderabad" },
  { value: "WH_BLR", label: "Bengaluru" },
];

// LocalStorage persistence utilities
const LOCATION_FILTER_STORAGE_KEY = "regionalManagerLocationFilter";

export function loadFilterFromStorage(): "combined" | "WH_HYD" | "WH_BLR" {
  try {
    const stored = localStorage.getItem(LOCATION_FILTER_STORAGE_KEY);
    if (stored === "WH_HYD" || stored === "WH_BLR" || stored === "combined") {
      return stored;
    }
    // Invalid value stored - return default
    if (stored !== null) {
      console.warn(
        `Invalid location filter value in storage: "${stored}". Falling back to "combined".`
      );
    }
  } catch (error) {
    console.warn("Failed to load location filter from storage:", error);
  }
  return "combined"; // Default fallback
}

export function saveFilterToStorage(value: "combined" | "WH_HYD" | "WH_BLR"): void {
  try {
    localStorage.setItem(LOCATION_FILTER_STORAGE_KEY, value);
  } catch (error) {
    console.warn("Failed to save location filter to storage:", error);
  }
}

export function LocationFilter({ value, onChange, disabled }: LocationFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">
        Location
      </span>
      <div className="relative">
        <select
          aria-label="Select warehouse location filter"
          value={value}
          onChange={(e) => onChange(e.target.value as "combined" | "WH_HYD" | "WH_BLR")}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          className="appearance-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] py-2 pl-3 pr-8 text-[11px] font-bold text-[#E8EDF8] outline-none transition-colors hover:border-[#2A3F68] disabled:opacity-50"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4E6090]" />
      </div>
    </div>
  );
}
