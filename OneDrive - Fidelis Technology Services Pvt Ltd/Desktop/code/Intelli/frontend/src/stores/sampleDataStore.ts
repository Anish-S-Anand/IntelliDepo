/**
 * Sample Data Store — company financials & client portfolio
 *
 * Powers Peer Benchmarking and Revenue Concentration features.
 */
import { create } from "zustand";
import type {
  CompanyFinancial,
  ClientPortfolio,
  PeerBenchmarkResponse,
  RevenueConcentrationResponse,
  CompanyFilters,
  ClientFilters,
} from "@/types/stream";
import * as sampleDataApi from "@/services/sampleData";

interface SampleDataState {
  // Companies (Peer Benchmarking)
  companies: CompanyFinancial[];
  sectors: string[];
  fiscalYears: number[];
  selectedCompanies: string[]; // tickers for comparison
  companyFilters: CompanyFilters;

  // Clients (Revenue Concentration)
  clients: ClientPortfolio[];
  totalRevenue: number;
  herfindahlIndex: number;
  topClientShare: number;
  top3Share: number;
  top5Share: number;
  clientFilters: ClientFilters;

  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCompanies: (filters?: CompanyFilters) => Promise<void>;
  fetchCompany: (ticker: string) => Promise<CompanyFinancial>;
  fetchClients: (filters?: ClientFilters) => Promise<void>;
  setCompanyFilters: (filters: CompanyFilters) => void;
  setClientFilters: (filters: ClientFilters) => void;
  toggleCompanySelection: (ticker: string) => void;
  clearCompanySelection: () => void;
  seedData: () => Promise<void>;
  clearError: () => void;
}

export const useSampleDataStore = create<SampleDataState>((set, get) => ({
  companies: [],
  sectors: [],
  fiscalYears: [],
  selectedCompanies: [],
  companyFilters: {},

  clients: [],
  totalRevenue: 0,
  herfindahlIndex: 0,
  topClientShare: 0,
  top3Share: 0,
  top5Share: 0,
  clientFilters: {},

  isLoading: false,
  error: null,

  fetchCompanies: async (filters) => {
    set({ isLoading: true, error: null });
    if (filters) set({ companyFilters: filters });
    try {
      const data: PeerBenchmarkResponse = await sampleDataApi.getCompanies(
        filters ?? get().companyFilters
      );
      set({
        companies: data.companies,
        sectors: data.sectors,
        fiscalYears: data.fiscal_years,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchCompany: async (ticker) => {
    const company = await sampleDataApi.getCompany(ticker);
    return company;
  },

  fetchClients: async (filters) => {
    set({ isLoading: true, error: null });
    if (filters) set({ clientFilters: filters });
    try {
      const data: RevenueConcentrationResponse = await sampleDataApi.getClients(
        filters ?? get().clientFilters
      );
      set({
        clients: data.clients,
        totalRevenue: data.total_revenue,
        herfindahlIndex: data.herfindahl_index,
        topClientShare: data.top_client_share,
        top3Share: data.top_3_share,
        top5Share: data.top_5_share,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setCompanyFilters: (filters) => set({ companyFilters: filters }),
  setClientFilters: (filters) => set({ clientFilters: filters }),

  toggleCompanySelection: (ticker) => {
    set((state) => {
      const selected = state.selectedCompanies.includes(ticker)
        ? state.selectedCompanies.filter((t) => t !== ticker)
        : [...state.selectedCompanies, ticker];
      return { selectedCompanies: selected };
    });
  },

  clearCompanySelection: () => set({ selectedCompanies: [] }),

  seedData: async () => {
    set({ isLoading: true, error: null });
    try {
      await sampleDataApi.seedSampleData();
      // Refresh both datasets after seeding
      await get().fetchCompanies();
      await get().fetchClients();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
