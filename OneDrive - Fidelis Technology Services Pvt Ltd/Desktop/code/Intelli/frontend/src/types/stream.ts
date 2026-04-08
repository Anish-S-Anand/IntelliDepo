/**
 * Intelli Stream — TypeScript types for all 3 backend APIs
 *
 * STR-API-1: Sample Data (companies, clients)
 * STR-API-2: Scenario Engine (what-if, sensitivity)
 * STR-API-3: Earnings Transcript (NLP analysis)
 */

// ══════════════════════════════════════════════════════════════════════
// STR-API-1: Sample Data Types
// ══════════════════════════════════════════════════════════════════════

export interface CompanyFinancial {
  id: string;
  company_name: string;
  ticker: string;
  sector: string;
  fiscal_year: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  ebitda: number;
  net_income: number;
  gross_margin: number;
  ebitda_margin: number;
  net_margin: number;
  total_assets: number;
  total_debt: number;
  cash_and_equivalents: number;
  total_equity: number;
  roe: number;
  debt_to_equity: number;
  current_ratio: number;
  employees: number | null;
}

export interface PeerBenchmarkResponse {
  companies: CompanyFinancial[];
  sectors: string[];
  fiscal_years: number[];
  count: number;
}

export interface ClientPortfolio {
  id: string;
  client_name: string;
  industry: string;
  region: string;
  annual_revenue: number;
  contract_type: string;
  risk_tier: string;
  relationship_years: number;
  notes: string | null;
}

export interface RevenueConcentrationResponse {
  clients: ClientPortfolio[];
  total_revenue: number;
  herfindahl_index: number;
  top_client_share: number;
  top_3_share: number;
  top_5_share: number;
  count: number;
}

export interface CompanyFilters {
  sector?: string;
  fiscal_year?: number;
  tickers?: string;
}

export interface ClientFilters {
  region?: string;
  industry?: string;
  risk_tier?: string;
}

// ══════════════════════════════════════════════════════════════════════
// STR-API-2: Scenario Engine Types
// ══════════════════════════════════════════════════════════════════════

export interface SensitivityConfig {
  id: string;
  scenario_id: string;
  variable_name: string;
  display_label: string;
  min_pct: number;
  max_pct: number;
  step_pct: number;
  results: Record<string, unknown>[] | null;
}

export interface SensitivityConfigCreate {
  variable_name: string;
  display_label: string;
  min_pct?: number;
  max_pct?: number;
  step_pct?: number;
  results?: Record<string, unknown>[] | null;
}

export interface SensitivityConfigUpdate {
  variable_name?: string;
  display_label?: string;
  min_pct?: number;
  max_pct?: number;
  step_pct?: number;
  results?: Record<string, unknown>[] | null;
}

export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_baseline: boolean;
  base_inputs: Record<string, number>;
  adjusted_inputs: Record<string, number>;
  computed_results: Record<string, number> | null;
  tags: string[] | null;
  sensitivity_configs: SensitivityConfig[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ScenarioCreate {
  name: string;
  description?: string;
  is_baseline?: boolean;
  base_inputs?: Record<string, number>;
  adjusted_inputs?: Record<string, number>;
  computed_results?: Record<string, number>;
  tags?: string[];
  sensitivity_configs?: SensitivityConfigCreate[];
}

export interface ScenarioUpdate {
  name?: string;
  description?: string;
  adjusted_inputs?: Record<string, number>;
  computed_results?: Record<string, number>;
  tags?: string[];
}

export interface ScenarioListResponse {
  scenarios: Scenario[];
  total: number;
}

// ══════════════════════════════════════════════════════════════════════
// STR-API-3: Earnings Transcript Types
// ══════════════════════════════════════════════════════════════════════

export interface TranscriptListItem {
  id: string;
  company_name: string;
  ticker: string;
  fiscal_quarter: string;
  fiscal_year: number;
  overall_sentiment: number;
  management_tone: string | null;
  is_ingested: boolean;
}

export interface Transcript {
  id: string;
  company_name: string;
  ticker: string;
  fiscal_quarter: string;
  fiscal_year: number;
  key_themes: Record<string, unknown>[] | null;
  sentiment_timeline: Record<string, unknown>[] | null;
  overall_sentiment: number;
  summary: string | null;
  key_metrics_mentioned: Record<string, unknown>[] | null;
  management_tone: string | null;
  risk_flags: Record<string, unknown>[] | null;
  is_ingested: boolean;
}

export interface TranscriptUpload {
  company_name: string;
  ticker: string;
  fiscal_quarter: string;
  fiscal_year: number;
  transcript_text: string;
}

export interface TranscriptQuery {
  ticker: string;
  question: string;
}

export interface TranscriptQueryResponse {
  answer: string;
  sources: Record<string, unknown>[];
  company: string | null;
  quarter: string | null;
  model: string | null;
}

export interface CompetitiveComparison {
  companies: Record<string, unknown>[];
  metrics_comparison: Record<string, unknown>[];
  sentiment_comparison: Record<string, unknown>[];
}
