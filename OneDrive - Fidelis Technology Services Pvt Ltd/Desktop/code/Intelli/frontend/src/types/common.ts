/**
 * Intelli Platform — Common UI Types
 */

// ── Navigation ─────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ── Dashboard ──────────────────────────────────────────

export type StreamFeature =
  | 'what-if'
  | 'sensitivity'
  | 'peer-benchmarking'
  | 'revenue-concentration'
  | 'earnings-analysis';

export interface DashboardTab {
  id: StreamFeature;
  label: string;
  icon?: string;
  description?: string;
}

// ── Data Table ─────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

// ── Charts ─────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface DonutSlice {
  label: string;
  value: number;
  share: number;
  color: string;
}

// ── Formatting ─────────────────────────────────────────

export type NumberFormat = 'currency' | 'percent' | 'number' | 'compact';

export interface FormatOptions {
  format: NumberFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

// ── API State ──────────────────────────────────────────

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}
