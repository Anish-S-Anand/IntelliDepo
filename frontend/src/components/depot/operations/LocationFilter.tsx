"use client";

import { ChevronDown } from "lucide-react";

export interface LocationFilterProps {
  value: "combined" | "WH_HYD" | "WH_BLR" | "WH_MUM";
  onChange: (value: "combined" | "WH_HYD" | "WH_BLR" | "WH_MUM") => void;
  disabled?: boolean;
  options?: FilterOption[];
}

type FilterOption = {
  value: "combined" | "WH_HYD" | "WH_BLR" | "WH_MUM";
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "combined", label: "Hyderabad and Bengaluru (Combined)" },
  { value: "WH_HYD", label: "Hyderabad" },
  { value: "WH_BLR", label: "Bengaluru" },
];

// LocalStorage persistence utilities
const LOCATION_FILTER_STORAGE_KEY = "regionalManagerLocationFilter";

export function loadFilterFromStorage(): "combined" | "WH_HYD" | "WH_BLR" | "WH_MUM" {
  try {
    const stored = localStorage.getItem(LOCATION_FILTER_STORAGE_KEY);
    if (stored === "WH_HYD" || stored === "WH_BLR" || stored === "WH_MUM" || stored === "combined") {
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

export function saveFilterToStorage(value: "combined" | "WH_HYD" | "WH_BLR" | "WH_MUM"): void {
  try {
    localStorage.setItem(LOCATION_FILTER_STORAGE_KEY, value);
  } catch (error) {
    console.warn("Failed to save location filter to storage:", error);
  }
}

export function LocationFilter({ value, onChange, disabled, options }: LocationFilterProps) {
  const filterOptions = options || FILTER_OPTIONS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">
        Location
      </span>
      <div className="relative">
        <select
          aria-label="Select warehouse location filter"
          value={value}
          onChange={(e) => onChange(e.target.value as "combined" | "WH_HYD" | "WH_BLR" | "WH_MUM")}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          className="appearance-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] py-2 pl-3 pr-8 text-[11px] font-bold text-[#E8EDF8] outline-none transition-colors hover:border-[#2A3F68] disabled:opacity-50"
        >
          {filterOptions.map((option) => (
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
