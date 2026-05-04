/**
 * Intelli Stream — Financial Data Types
 * Shared across What-if Simulations, Sensitivity Mapping,
 * Peer Benchmarking, and Revenue Concentration features.
 */

// ── Income Statement Model ──────────────────────────────

export interface IncomeStatement {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interestExpense: number;
  taxRate: number;
  taxes: number;
  netIncome: number;
}

export interface FinancialMargins {
  grossMargin: number;
  ebitdaMargin: number;
  ebitMargin: number;
  netMargin: number;
}

export interface FinancialModel extends IncomeStatement {
  margins: FinancialMargins;
}

// ── What-if Scenario ────────────────────────────────────

export interface ScenarioVariable {
  key: keyof IncomeStatement;
  label: string;
  baseValue: number;
  adjustedValue: number;
  /** Percentage change from base: -0.5 = -50%, 0.2 = +20% */
  changePct: number;
  min: number;
  max: number;
  step: number;
  format: 'currency' | 'percent' | 'number';
}

export interface ScenarioDelta {
  field: string;
  label: string;
  baseValue: number;
  newValue: number;
  absoluteChange: number;
  percentChange: number;
}

export interface ScenarioResult {
  base: FinancialModel;
  adjusted: FinancialModel;
  deltas: ScenarioDelta[];
}

// ── Sensitivity Analysis ────────────────────────────────

export interface SensitivityDriver {
  key: string;
  label: string;
  /** Impact on target metric when driver moves ±1% */
  impactPerPercent: number;
  /** Absolute impact at the tested swing range */
  absoluteImpact: number;
  /** Direction: positive = same direction, negative = inverse */
  direction: 'positive' | 'negative';
}

export interface TornadoBar {
  driver: string;
  label: string;
  lowValue: number;
  highValue: number;
  baseValue: number;
  lowLabel: string;
  highLabel: string;
}

export interface SensitivityResult {
  targetMetric: string;
  targetLabel: string;
  baseValue: number;
  drivers: SensitivityDriver[];
  tornado: TornadoBar[];
}

// ── Revenue Concentration ───────────────────────────────

export interface ClientRevenue {
  clientName: string;
  industry: string;
  region: string;
  annualRevenue: number;
  contractType: string;
  riskTier: 'low' | 'medium' | 'high';
  relationshipYears: number;
}

export interface ConcentrationMetrics {
  totalRevenue: number;
  herfindahlIndex: number;
  topClientShare: number;
  top3Share: number;
  top5Share: number;
  clientCount: number;
  /** HHI classification */
  concentrationLevel: 'diversified' | 'moderate' | 'concentrated';
}

export interface RevenueSlice {
  clientName: string;
  revenue: number;
  share: number;
  cumulativeShare: number;
}

// ── Peer Benchmarking ───────────────────────────────────

export interface CompanyFinancials {
  companyName: string;
  ticker: string;
  sector: string;
  fiscalYear: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  netIncome: number;
  grossMargin: number;
  ebitdaMargin: number;
  netMargin: number;
  totalAssets: number;
  totalDebt: number;
  cashAndEquivalents: number;
  totalEquity: number;
  roe: number;
  debtToEquity: number;
  currentRatio: number;
  employees: number | null;
}

// ── Radar Chart (Peer Benchmarking) ────────────────────

export interface RadarDataPoint {
  metric: string;
  label: string;
  /** Normalized 0-100 score for the radar axis */
  value: number;
  /** Raw value before normalization */
  rawValue: number;
}

export interface PeerRadarData {
  ticker: string;
  companyName: string;
  dataPoints: RadarDataPoint[];
}

export interface GapAnalysis {
  metric: string;
  label: string;
  companyValue: number;
  peerAverage: number;
  gap: number;
  gapPct: number;
  direction: 'above' | 'below' | 'equal';
}

// ── Earnings Transcript (frontend-specific) ────────────

export interface KeyTheme {
  theme: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  mentions: number;
  quotes: string[];
}

export interface SentimentTimelinePoint {
  section: string;
  sentiment: number;
  label: string;
}

export interface ExtractedMetric {
  name: string;
  value: string;
  context: string;
  changeDirection: 'up' | 'down' | 'flat' | null;
}

export interface RiskFlag {
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  quote: string | null;
}

export interface TranscriptAnalysis {
  themes: KeyTheme[];
  sentimentTimeline: SentimentTimelinePoint[];
  overallSentiment: number;
  summary: string;
  metrics: ExtractedMetric[];
  managementTone: string;
  riskFlags: RiskFlag[];
}
