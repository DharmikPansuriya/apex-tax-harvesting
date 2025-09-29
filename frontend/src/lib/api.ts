/**
 * API client for TLH UK backend
 */

import {
  Holding,
  Transaction,
  Section104Pool,
  DisposalMatch,
  CGTReport,
  TLHOpportunity,
  ApiResponse,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid, clear it and trigger logout
          this.clearAuthToken();
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          localStorage.removeItem("user_profile");
          localStorage.removeItem("wealth_manager");
          localStorage.removeItem("client");

          // Trigger logout callback if set
          if (this.onUnauthorized) {
            console.log("API: 401 Unauthorized, triggering logout callback");
            this.onUnauthorized();
          } else {
            console.log("API: 401 Unauthorized, but no logout callback set");
          }
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("An unexpected error occurred");
    }
  }

  // Holdings
  async getHoldings(params?: {
    ticker?: string;
    name?: string;
  }): Promise<ApiResponse<Holding>> {
    const searchParams = new URLSearchParams();
    if (params?.ticker) searchParams.append("ticker", params.ticker);
    if (params?.name) searchParams.append("name", params.name);

    const queryString = searchParams.toString();
    const endpoint = `/api/holdings/${queryString ? `?${queryString}` : ""}`;

    return this.request<ApiResponse<Holding>>(endpoint);
  }

  async getHolding(id: string): Promise<Holding> {
    return this.request<Holding>(`/api/holdings/${id}/`);
  }

  // Transactions
  async getTransactions(params?: {
    holding?: string;
    side?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<Transaction>> {
    const searchParams = new URLSearchParams();
    if (params?.holding) searchParams.append("holding", params.holding);
    if (params?.side) searchParams.append("side", params.side);
    if (params?.start_date)
      searchParams.append("start_date", params.start_date);
    if (params?.end_date) searchParams.append("end_date", params.end_date);

    const queryString = searchParams.toString();
    const endpoint = `/api/transactions/${
      queryString ? `?${queryString}` : ""
    }`;

    return this.request<ApiResponse<Transaction>>(endpoint);
  }

  // Section 104 Pools
  async getSection104Pools(params?: {
    holding?: string;
    non_zero?: boolean;
  }): Promise<ApiResponse<Section104Pool>> {
    const searchParams = new URLSearchParams();
    if (params?.holding) searchParams.append("holding", params.holding);
    if (params?.non_zero) searchParams.append("non_zero", "true");

    const queryString = searchParams.toString();
    const endpoint = `/api/section104-pools/${
      queryString ? `?${queryString}` : ""
    }`;

    return this.request<ApiResponse<Section104Pool>>(endpoint);
  }

  // Disposal Matches
  async getDisposalMatches(params?: {
    sell_tx?: string;
    buy_tx?: string;
  }): Promise<ApiResponse<DisposalMatch>> {
    const searchParams = new URLSearchParams();
    if (params?.sell_tx) searchParams.append("sell_tx", params.sell_tx);
    if (params?.buy_tx) searchParams.append("buy_tx", params.buy_tx);

    const queryString = searchParams.toString();
    const endpoint = `/api/disposal-matches/${
      queryString ? `?${queryString}` : ""
    }`;

    return this.request<ApiResponse<DisposalMatch>>(endpoint);
  }

  // CGT Reports
  async getCGTReports(params?: {
    tax_year?: string;
  }): Promise<ApiResponse<CGTReport>> {
    const searchParams = new URLSearchParams();
    if (params?.tax_year) searchParams.append("tax_year", params.tax_year);

    const queryString = searchParams.toString();
    const endpoint = `/api/reports/${queryString ? `?${queryString}` : ""}`;

    return this.request<ApiResponse<CGTReport>>(endpoint);
  }

  async generateCGTReport(
    taxYear: string = "2024-25"
  ): Promise<{ message: string; report: CGTReport }> {
    return this.request<{ message: string; report: CGTReport }>(
      `/api/tlh/opportunities/generate_report/?tax_year=${taxYear}`,
      { method: "POST" }
    );
  }

  // TLH Opportunities
  async getTLHOpportunities(): Promise<ApiResponse<TLHOpportunity>> {
    return this.request<ApiResponse<TLHOpportunity>>("/api/tlh/opportunities/");
  }

  // Financial Advisor endpoints
  async getWealthManagers(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/api/wealth-managers/");
  }

  // Client endpoints
  async getClients(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/api/clients/");
  }

  async getClient(id: string): Promise<any> {
    return this.request<any>(`/api/clients/${id}/`);
  }

  async createClient(data: any): Promise<any> {
    return this.request<any>("/api/clients/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: string, data: any): Promise<any> {
    return this.request<any>(`/api/clients/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: string): Promise<void> {
    return this.request<void>(`/api/clients/${id}/`, { method: "DELETE" });
  }

  // CSV Upload endpoints
  async getCSVUploads(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/api/csv-uploads/");
  }

  // Transactions
  // async getTransactions(): Promise<ApiResponse<any>> {
  //   return this.request<ApiResponse<any>>("/api/transactions/");
  // }

  async uploadCSV(formData: FormData): Promise<any> {
    const url = `${this.baseUrl}/api/csv-uploads/`;

    const config: RequestInit = {
      method: "POST",
      body: formData,
      headers: {
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        // Don't set Content-Type for FormData - let browser set it with boundary
      },
    };

    try {
      console.log("Sending request to:", url);
      console.log("Request body:", formData);

      const response = await fetch(url, config);

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        if (response.status === 401) {
          this.clearAuthToken();
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          localStorage.removeItem("user_profile");
          localStorage.removeItem("wealth_manager");
          localStorage.removeItem("client");

          if (this.onUnauthorized) {
            this.onUnauthorized();
          }
        }
        const errorData = await response.json().catch(() => ({}));
        console.log("Error response data:", errorData);
        throw new Error(
          errorData.error ||
            errorData.detail ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Success response:", result);
      return result;
    } catch (error) {
      console.error("Upload error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("An unexpected error occurred");
    }
  }

  async processCSVUpload(id: string): Promise<any> {
    return this.request<any>(`/api/csv-uploads/${id}/process/`, {
      method: "POST",
    });
  }

  // Authentication endpoints
  async login(data: { username: string; password: string }): Promise<any> {
    return this.request<any>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    user_type: string;
    firm_name?: string;
    license_number?: string;
    phone?: string;
  }): Promise<any> {
    return this.request<any>("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async logout(refreshToken: string): Promise<any> {
    return this.request<any>("/api/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    });
  }

  async refreshToken(refreshToken: string): Promise<any> {
    return this.request<any>("/api/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    });
  }

  async getMe(): Promise<any> {
    return this.request<any>("/api/auth/me/");
  }

  // File downloads
  async downloadCSV(reportId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/reports/${reportId}/download_csv/`
    );
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.statusText}`);
    }
    return response.blob();
  }

  async downloadPDF(reportId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/reports/${reportId}/download_pdf/`
    );
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    return response.blob();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
