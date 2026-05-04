import type { SectorMultipliers } from "@/lib/sectorConfig";

export interface MarketInputs {
  repoRate: number;
  inrRate: number;
  wpi: number;
  crude: number;
  gSecYield: number;
}

export interface MonthlyImpactPoint {
  month: string;
  borrowing: number;
  fx: number;
  cogs: number;
  mtm: number;
  combined: number;
}

export const PERIOD_SCALE: Record<"1M" | "3M" | "6M" | "YTD", number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  YTD: 12,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calcBorrowingImpact(
  repoRateDeltaPts: number,
  multipliers: SectorMultipliers,
  scale = 1,
): number {
  return 250 * 0.65 * (repoRateDeltaPts / 100) * multipliers.rate * scale;
}

export function calcFXImpact(
  fxDeltaPercent: number,
  multipliers: SectorMultipliers,
  scale = 1,
): number {
  const deltaRatio = Math.abs(fxDeltaPercent) / 100;
  return 12.5 * (84.2 / 100) * 0.35 * deltaRatio * multipliers.fx * scale;
}

export function calcAIProbability(
  repoRateDeltaPts: number,
  fxDeltaPercent: number,
  crudePrice: number,
): number {
  const crudeDelta = Math.abs(crudePrice - 87.5);
  const score =
    Math.abs(repoRateDeltaPts) * 8 +
    Math.abs(fxDeltaPercent) * 2.5 +
    crudeDelta * 1.2;
  return Math.round(clamp(20 + score, 5, 98));
}

function monthLabel(index: number): string {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[index % labels.length] ?? `M${index + 1}`;
}

export function calcMonthlyDataFromMarketInputs(
  scenario: MarketInputs,
  live: MarketInputs,
  geoFilters: boolean[],
  numMonths: number,
  multipliers: SectorMultipliers,
): MonthlyImpactPoint[] {
  const safeMonths = Math.max(1, numMonths);
  const enabledGeos = geoFilters.filter(Boolean).length;
  const geoBase = geoFilters.length > 0 ? enabledGeos / geoFilters.length : 1;
  const geoScale = enabledGeos === 0 ? 1 : 0.75 + geoBase * 0.55;

  const borrowingTotal = calcBorrowingImpact(scenario.repoRate - live.repoRate, multipliers, 1) * geoScale;
  const fxTotal =
    calcFXImpact(((scenario.inrRate / live.inrRate) - 1) * 100, multipliers, 1) * geoScale;
  const wpiTotal =
    180 * 0.45 * ((scenario.wpi - live.wpi) / 100) * multipliers.wpi * geoScale;
  const crudeTotal =
    180 * 0.25 * ((scenario.crude - live.crude) / live.crude) * multipliers.crude * geoScale;
  const mtmTotal =
    60 * 4.2 * ((scenario.gSecYield - live.gSecYield) / 100) * geoScale;

  const cogsTotal = wpiTotal + crudeTotal;

  return Array.from({ length: safeMonths }, (_, index) => {
    const progress = (index + 1) / safeMonths;
    const trendWeight = 0.85 + progress * 0.3;
    const seasonality = 1 + Math.sin((index / safeMonths) * Math.PI * 2) * 0.08;
    const weight = trendWeight * seasonality;

    const borrowing = (borrowingTotal / safeMonths) * weight;
    const fx = (fxTotal / safeMonths) * weight;
    const cogs = (cogsTotal / safeMonths) * weight;
    const mtm = (mtmTotal / safeMonths) * weight;
    const combined = borrowing + fx + cogs + mtm;

    return {
      month: monthLabel(index),
      borrowing,
      fx,
      cogs,
      mtm,
      combined,
    };
  });
}
