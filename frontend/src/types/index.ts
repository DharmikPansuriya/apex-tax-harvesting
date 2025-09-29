/**
 * TypeScript types for TLH UK application
 */

export interface Holding {
  id: string;
  isin: string;
  sedol?: string;
  ticker: string;
  name: string;
  created_at: string;
  updated_at: string;
  section104_pool?: {
    pooled_qty: number;
    pooled_cost: number;
    avg_cost: number;
  };
  current_price: number;
  unrealised_pnl: number;
  unrealised_pnl_pct: number;
}

export interface Transaction {
  id: string;
  holding: string;
  holding_ticker: string;
  holding_name: string;
  trade_date: string;
  qty: number;
  price: number;
  fees: number;
  side: "BUY" | "SELL";
  account: string;
  total_value: number;
  net_value: number;
  // Server-calculated convenience fields (optional while rolling out)
  notional?: number;
  pl?: number | null;
  cost_basis_avg?: number | null;
  created_at: string;
}

export interface Section104Pool {
  id: string;
  holding: string;
  holding_ticker: string;
  holding_name: string;
  pooled_qty: number;
  pooled_cost: number;
  avg_cost: number;
  created_at: string;
  updated_at: string;
}

export interface DisposalMatch {
  id: string;
  sell_tx: string;
  matched_buy_tx: string;
  sell_tx_ticker: string;
  sell_tx_date: string;
  buy_tx_ticker: string;
  buy_tx_date: string;
  qty_matched: number;
  disallowed_loss: number;
  created_at: string;
}

export interface CGTReport {
  id: string;
  tax_year: string;
  totals: {
    total_disposals: number;
    total_proceeds: number;
    total_cost: number;
    gross_gains: number;
    gross_losses: number;
    disallowed_losses: number;
    net_gains: number;
    annual_exempt_amount: number;
    taxable_gains: number;
    carry_forward_losses: number;
  };
  csv_path?: string;
  pdf_path?: string;
  csv_url?: string;
  pdf_url?: string;
  created_at: string;
}

export interface TLHOpportunity {
  holding_id: string;
  ticker: string;
  name: string;
  current_price: number;
  avg_cost: number;
  unrealised_pnl: number;
  unrealised_pnl_pct: number;
  pooled_qty: number;
  score: number;
  reason: string;
  constraints: {
    thirty_day_rule: {
      blocked: boolean;
      days_remaining?: number;
      last_sale_date?: string;
      message?: string;
    };
  };
  eligible: boolean;
}

export interface ApiResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ApiError {
  error: string;
  detail?: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  risk_profile: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
  total_portfolio_value: number;
  holding_count?: number;
  total_unrealised_pnl?: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  client_type:
    | "individual"
    | "wealth_manager"
    | "financial_advisor"
    | "institution";
  firm_name?: string;
  license_number?: string;
  phone?: string;
}

export interface WealthManager {
  id: number;
  firm_name: string;
  license_number?: string;
  phone?: string;
  client_count?: number;
  created_at: string;
  updated_at: string;
}
