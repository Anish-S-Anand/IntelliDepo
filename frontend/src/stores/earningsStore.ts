/**
 * Earnings Store — transcript analysis, RAG queries, comparisons
 *
 * Powers the Earnings Transcript Analysis and Peer Benchmarking features.
 */
import { create } from "zustand";
import type {
  Transcript,
  TranscriptListItem,
  TranscriptUpload,
  TranscriptQueryResponse,
  CompetitiveComparison,
} from "@/types/stream";
import * as earningsApi from "@/services/earnings";

interface EarningsState {
  transcripts: TranscriptListItem[];
  activeTranscript: Transcript | null;
  queryResult: TranscriptQueryResponse | null;
  comparison: CompetitiveComparison | null;
  isLoading: boolean;
  isQuerying: boolean;
  error: string | null;

  // Transcript CRUD
  fetchTranscripts: (ticker?: string) => Promise<void>;
  fetchTranscript: (id: string) => Promise<void>;
  uploadTranscript: (body: TranscriptUpload) => Promise<Transcript>;
  uploadTranscriptFile: (
    file: File,
    meta: { company_name: string; ticker: string; fiscal_quarter: string; fiscal_year: number }
  ) => Promise<Transcript>;

  // RAG Query
  queryEarnings: (ticker: string, question: string) => Promise<void>;
  clearQueryResult: () => void;

  // Competitive Comparison
  compareTranscripts: (tickers: string[]) => Promise<void>;
  clearComparison: () => void;

  // Seed & misc
  seedTranscripts: () => Promise<void>;
  setActiveTranscript: (transcript: Transcript | null) => void;
  clearError: () => void;
}

export const useEarningsStore = create<EarningsState>((set, get) => ({
  transcripts: [],
  activeTranscript: null,
  queryResult: null,
  comparison: null,
  isLoading: false,
  isQuerying: false,
  error: null,

  fetchTranscripts: async (ticker) => {
    set({ isLoading: true, error: null });
    try {
      const transcripts = await earningsApi.listTranscripts(ticker);
      set({ transcripts, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchTranscript: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const transcript = await earningsApi.getTranscript(id);
      set({ activeTranscript: transcript, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  uploadTranscript: async (body) => {
    set({ isLoading: true, error: null });
    try {
      const transcript = await earningsApi.uploadTranscript(body);
      set((state) => ({
        transcripts: [
          {
            id: transcript.id,
            company_name: transcript.company_name,
            ticker: transcript.ticker,
            fiscal_quarter: transcript.fiscal_quarter,
            fiscal_year: transcript.fiscal_year,
            overall_sentiment: transcript.overall_sentiment,
            management_tone: transcript.management_tone,
            is_ingested: transcript.is_ingested,
          },
          ...state.transcripts,
        ],
        activeTranscript: transcript,
        isLoading: false,
      }));
      return transcript;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  uploadTranscriptFile: async (file, meta) => {
    set({ isLoading: true, error: null });
    try {
      const transcript = await earningsApi.uploadTranscriptFile(file, meta);
      set((state) => ({
        transcripts: [
          {
            id: transcript.id,
            company_name: transcript.company_name,
            ticker: transcript.ticker,
            fiscal_quarter: transcript.fiscal_quarter,
            fiscal_year: transcript.fiscal_year,
            overall_sentiment: transcript.overall_sentiment,
            management_tone: transcript.management_tone,
            is_ingested: transcript.is_ingested,
          },
          ...state.transcripts,
        ],
        activeTranscript: transcript,
        isLoading: false,
      }));
      return transcript;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  queryEarnings: async (ticker, question) => {
    set({ isQuerying: true, error: null, queryResult: null });
    try {
      const result = await earningsApi.queryEarnings({ ticker, question });
      set({ queryResult: result, isQuerying: false });
    } catch (err: any) {
      set({ error: err.message, isQuerying: false });
    }
  },

  clearQueryResult: () => set({ queryResult: null }),

  compareTranscripts: async (tickers) => {
    set({ isLoading: true, error: null, comparison: null });
    try {
      const comparison = await earningsApi.compareTranscripts(tickers);
      set({ comparison, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  clearComparison: () => set({ comparison: null }),

  seedTranscripts: async () => {
    set({ isLoading: true, error: null });
    try {
      await earningsApi.seedTranscripts();
      await get().fetchTranscripts();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setActiveTranscript: (transcript) => set({ activeTranscript: transcript }),
  clearError: () => set({ error: null }),
}));
