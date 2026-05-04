import { create } from "zustand";
import { COMPANY_GROUPS, getSectorById } from "@/lib/sectorConfig";

export type Region = "IN" | "UAE" | "SA";
export type Period = "1M" | "3M" | "6M" | "YTD";

export const ALL_VARIABLES = ["Repo Rate", "FX USD/INR", "WPI Inflation", "Crude Oil", "G-Sec Yield"] as const;
export type Variable = (typeof ALL_VARIABLES)[number];

// Live market values (hardcoded; would come from API in production)
export const LIVE_VALUES = {
  repoRate:   6.50,
  inrRate:    84.20,
  wpi:        5.10,
  crude:      87.50,
  gSecYield:  7.20,
} as const;

export interface SimulationState {
  // Global scenario sliders
  rateShock: number;
  fxVolatility: number;
  crudePrice: number;
  selectedSector: string;
  selectedSubIndustry: string;
  region: Region;
  period: Period;
  variables: Variable[];
  isRunning: boolean;
  geoFilters: boolean[];

  // Company / sector cascade
  selectedCompany: string;
  selectedSectorId: string;

  // Per-card manual overrides (null = use global/live value)
  cardRepoRate:  number | null;
  cardINRRate:   number | null;
  cardWPI:       number | null;
  cardCrude:     number | null;
  cardGSecYield: number | null;

  // Combined macro impact override (null = computed from sliders)
  combinedMacroOverride: number | null;

  // Actions — global
  setRateShock: (v: number) => void;
  setFxVolatility: (v: number) => void;
  setCrudePrice: (v: number) => void;
  setSelectedSector: (v: string) => void;
  setSelectedSubIndustry: (v: string) => void;
  setRegion: (v: Region) => void;
  setPeriod: (v: Period) => void;
  setVariables: (v: Variable[]) => void;
  setIsRunning: (v: boolean) => void;
  setGeoFilters: (v: boolean[]) => void;

  // Actions — company / sector cascade
  setCompany: (companyId: string) => void;
  setSector: (sectorId: string) => void;

  // Actions — per-card overrides
  setCardRepoRate:  (v: number | null) => void;
  setCardINRRate:   (v: number | null) => void;
  setCardWPI:       (v: number | null) => void;
  setCardCrude:     (v: number | null) => void;
  setCardGSecYield: (v: number | null) => void;
  resetAllCardRates: () => void;
  setCombinedMacroOverride: (v: number | null) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  rateShock: 1.3,
  fxVolatility: -4.2,
  crudePrice: 82,
  // selectedSector holds the sectorId so getSectorMultipliers(selectedSector) works
  selectedSector: "ab-metals",
  selectedSubIndustry: "Hindalco",
  region: "IN",
  period: "YTD",
  variables: [...ALL_VARIABLES],
  isRunning: false,
  geoFilters: [false, false, false, true],

  selectedCompany: "aditya-birla",
  selectedSectorId: "ab-metals",

  cardRepoRate:  null,
  cardINRRate:   null,
  cardWPI:       null,
  cardCrude:     null,
  cardGSecYield: null,
  combinedMacroOverride: null,

  setRateShock:           (v) => set({ rateShock: v }),
  setFxVolatility:        (v) => set({ fxVolatility: v }),
  setCrudePrice:          (v) => set({ crudePrice: v }),
  setSelectedSector:      (v) => set({ selectedSector: v }),
  setSelectedSubIndustry: (v) => set({ selectedSubIndustry: v }),
  setRegion:              (v) => set({ region: v }),
  setPeriod:              (v) => set({ period: v }),
  setVariables:           (v) => set({ variables: v }),
  setIsRunning:           (v) => set({ isRunning: v }),
  setGeoFilters:          (v) => set({ geoFilters: v }),

  setCompany: (companyId) => {
    const company = COMPANY_GROUPS.find((c) => c.id === companyId);
    if (!company || company.sectors.length === 0) {
      set({ selectedCompany: companyId });
      return;
    }
    const first = company.sectors[0];
    set({
      selectedCompany: companyId,
      selectedSectorId: first.id,
      selectedSector: first.id,
      selectedSubIndustry: first.entity,
    });
  },

  setSector: (sectorId) => {
    const sector = getSectorById(sectorId);
    if (!sector) return;
    set({
      selectedSectorId: sectorId,
      selectedSector: sectorId,
      selectedSubIndustry: sector.entity,
    });
  },

  setCardRepoRate:  (v) => set({ cardRepoRate: v }),
  setCardINRRate:   (v) => set({ cardINRRate: v }),
  setCardWPI:       (v) => set({ cardWPI: v }),
  setCardCrude:     (v) => set({ cardCrude: v }),
  setCardGSecYield: (v) => set({ cardGSecYield: v }),
  resetAllCardRates: () => set({
    cardRepoRate: null, cardINRRate: null,
    cardWPI: null, cardCrude: null, cardGSecYield: null,
  }),
  setCombinedMacroOverride: (v) => set({ combinedMacroOverride: v }),
}));
