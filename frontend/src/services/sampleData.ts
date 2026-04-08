/**
 * Intelli Stream — Sample Data API Service
 * Feature: STR-API-1
 *
 * Axios calls for company financials (Peer Benchmarking)
 * and client portfolio data (Revenue Concentration).
 */
import api from "./api";
import type {
  CompanyFinancial,
  PeerBenchmarkResponse,
  RevenueConcentrationResponse,
  CompanyFilters,
  ClientFilters,
} from "@/types/stream";

const BASE = "/api/v1/stream/data";

// ── Companies (Peer Benchmarking) ──────────────────────────────────

export async function getCompanies(
  filters?: CompanyFilters
): Promise<PeerBenchmarkResponse> {
  const params: Record<string, string | number> = {};
  if (filters?.sector) params.sector = filters.sector;
  if (filters?.fiscal_year) params.fiscal_year = filters.fiscal_year;
  if (filters?.tickers) params.tickers = filters.tickers;
  const { data } = await api.get<PeerBenchmarkResponse>(
    `${BASE}/companies`,
    { params }
  );
  return data;
}

export async function getCompany(ticker: string): Promise<CompanyFinancial> {
  const { data } = await api.get<CompanyFinancial>(
    `${BASE}/companies/${ticker}`
  );
  return data;
}

// ── Clients (Revenue Concentration) ────────────────────────────────

export async function getClients(
  filters?: ClientFilters
): Promise<RevenueConcentrationResponse> {
  const params: Record<string, string> = {};
  if (filters?.region) params.region = filters.region;
  if (filters?.industry) params.industry = filters.industry;
  if (filters?.risk_tier) params.risk_tier = filters.risk_tier;
  const { data } = await api.get<RevenueConcentrationResponse>(
    `${BASE}/clients`,
    { params }
  );
  return data;
}

// ── Seed ───────────────────────────────────────────────────────────

export async function seedSampleData(): Promise<{ status: string; seeded: Record<string, number> }> {
  const { data } = await api.post(`${BASE}/seed`);
  return data;
}
