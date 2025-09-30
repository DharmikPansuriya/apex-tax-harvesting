/**
 * React Query hooks for API calls
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Holding,
  Transaction,
  Section104Pool,
  DisposalMatch,
  CGTReport,
  TLHOpportunity,
  Client,
  WealthManager,
} from "@/types";

// Query keys
export const queryKeys = {
  holdings: ["holdings"] as const,
  holding: (id: string) => ["holdings", id] as const,
  transactions: ["transactions"] as const,
  transactionsByHolding: (holdingId: string) =>
    ["transactions", "holding", holdingId] as const,
  section104Pools: ["section104-pools"] as const,
  disposalMatches: ["disposal-matches"] as const,
  cgtReports: ["cgt-reports"] as const,
  tlhOpportunities: ["tlh-opportunities"] as const,
  clients: ["clients"] as const,
  client: (id: string) => ["clients", id] as const,
  wealthManagers: ["wealth-managers"] as const,
  csvUploads: ["csv-uploads"] as const,
};

// Holdings hooks
export function useHoldings(params?: { ticker?: string; name?: string }) {
  return useQuery({
    queryKey: [...queryKeys.holdings, params],
    queryFn: () => apiClient.getHoldings(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useHolding(id: string) {
  return useQuery({
    queryKey: queryKeys.holding(id),
    queryFn: () => apiClient.getHolding(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Transactions hooks
export function useTransactions(params?: {
  holding?: string;
  side?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: [...queryKeys.transactions, params],
    queryFn: () => apiClient.getTransactions(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransactionsByHolding(holdingId: string) {
  return useQuery({
    queryKey: queryKeys.transactionsByHolding(holdingId),
    queryFn: () => apiClient.getTransactions({ holding: holdingId }),
    enabled: !!holdingId,
    staleTime: 5 * 60 * 1000,
  });
}

// Section 104 Pools hooks
export function useSection104Pools(params?: {
  holding?: string;
  non_zero?: boolean;
}) {
  return useQuery({
    queryKey: [...queryKeys.section104Pools, params],
    queryFn: () => apiClient.getSection104Pools(params),
    staleTime: 5 * 60 * 1000,
  });
}

// Disposal Matches hooks
export function useDisposalMatches(params?: {
  sell_tx?: string;
  buy_tx?: string;
}) {
  return useQuery({
    queryKey: [...queryKeys.disposalMatches, params],
    queryFn: () => apiClient.getDisposalMatches(params),
    staleTime: 5 * 60 * 1000,
  });
}

// CGT Reports hooks
export function useCGTReports(params?: { tax_year?: string }) {
  return useQuery({
    queryKey: [...queryKeys.cgtReports, params],
    queryFn: () => apiClient.getCGTReports(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenerateCGTReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taxYear: string) => apiClient.generateCGTReport(taxYear),
    onSuccess: () => {
      // Invalidate and refetch reports
      queryClient.invalidateQueries({ queryKey: queryKeys.cgtReports });
    },
  });
}

// TLH Opportunities hooks
export function useTLHOpportunities(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.tlhOpportunities,
    queryFn: () => apiClient.getTLHOpportunities(),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent for TLH opportunities)
  });
}

// File download hooks
export function useDownloadCSV() {
  return useMutation({
    mutationFn: (reportId: string) => apiClient.downloadCSV(reportId),
  });
}

export function useDownloadPDF() {
  return useMutation({
    mutationFn: (reportId: string) => apiClient.downloadPDF(reportId),
  });
}

// Client hooks
export function useClients(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: () => apiClient.getClients(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.client(id),
    queryFn: () => apiClient.getClient(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCSVUploads(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.csvUploads,
    queryFn: () => apiClient.getCSVUploads(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Client>) => apiClient.createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      apiClient.updateClient(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      queryClient.invalidateQueries({ queryKey: queryKeys.client(id) });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

// Financial Advisor hooks
export function useWealthManagers() {
  return useQuery({
    queryKey: queryKeys.wealthManagers,
    queryFn: () => apiClient.getWealthManagers(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// TLH Execution hooks
export function useTLHExecutions(enabled: boolean = true) {
  return useQuery({
    queryKey: ["tlh-executions"],
    queryFn: () => apiClient.getTLHExecutions(),
    enabled,
  });
}

export function useCreateTLHExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      holding_id: string;
      client_id?: string;
      sell_price?: number;
      sell_fees?: number;
      replacement_ticker?: string;
      replacement_name?: string;
      replacement_qty?: number;
      replacement_price?: number;
      replacement_fees?: number;
      notes?: string;
    }) => apiClient.createTLHExecution(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tlh-executions"] });
      queryClient.invalidateQueries({ queryKey: ["tlh-opportunities"] });
    },
  });
}

export function useExecuteTLH() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (executionId: string) => apiClient.executeTLH(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tlh-executions"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useCancelTLH() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (executionId: string) => apiClient.cancelTLH(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tlh-executions"] });
    },
  });
}

export function useReplacementSuggestions(
  holdingId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["replacement-suggestions", holdingId],
    queryFn: () => apiClient.getReplacementSuggestions(holdingId),
    enabled: enabled && !!holdingId,
  });
}
