/**
 * Intelli Stream — Earnings Transcript API Service
 * Feature: STR-API-3
 *
 * Axios calls for transcript upload, NLP analysis, RAG queries,
 * and competitive comparison.
 */
import api from "./api";
import type {
  Transcript,
  TranscriptListItem,
  TranscriptUpload,
  TranscriptQuery,
  TranscriptQueryResponse,
  CompetitiveComparison,
} from "@/types/stream";

const BASE = "/api/v1/stream/earnings";

// ── Transcripts ────────────────────────────────────────────────────

export async function listTranscripts(
  ticker?: string
): Promise<TranscriptListItem[]> {
  const params = ticker ? { ticker } : {};
  const { data } = await api.get<TranscriptListItem[]>(
    `${BASE}/transcripts`,
    { params }
  );
  return data;
}

export async function getTranscript(id: string): Promise<Transcript> {
  const { data } = await api.get<Transcript>(`${BASE}/transcripts/${id}`);
  return data;
}

export async function uploadTranscript(
  body: TranscriptUpload
): Promise<Transcript> {
  const { data } = await api.post<Transcript>(`${BASE}/transcripts`, body);
  return data;
}

export async function uploadTranscriptFile(
  file: File,
  meta: {
    company_name: string;
    ticker: string;
    fiscal_quarter: string;
    fiscal_year: number;
  }
): Promise<Transcript> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("company_name", meta.company_name);
  formData.append("ticker", meta.ticker);
  formData.append("fiscal_quarter", meta.fiscal_quarter);
  formData.append("fiscal_year", String(meta.fiscal_year));
  const { data } = await api.post<Transcript>(
    `${BASE}/transcripts/upload-file`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

// ── RAG Query ──────────────────────────────────────────────────────

export async function queryEarnings(
  body: TranscriptQuery
): Promise<TranscriptQueryResponse> {
  const { data } = await api.post<TranscriptQueryResponse>(
    `${BASE}/query`,
    body
  );
  return data;
}

// ── Competitive Comparison ─────────────────────────────────────────

export async function compareTranscripts(
  tickers: string[]
): Promise<CompetitiveComparison> {
  const { data } = await api.get<CompetitiveComparison>(`${BASE}/compare`, {
    params: { tickers: tickers.join(",") },
  });
  return data;
}

// ── Seed ───────────────────────────────────────────────────────────

export async function seedTranscripts(): Promise<{
  seeded: number;
  transcripts: Record<string, unknown>[];
}> {
  const { data } = await api.post(`${BASE}/seed`);
  return data;
}
