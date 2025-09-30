"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  useClients,
  useWealthManagers,
  useHoldings,
  useTLHOpportunities,
  useTLHExecutions,
} from "@/hooks/useApi";
import { Client } from "@/types";
import { formatCurrency } from "@/utils/format";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  PieChart,
  Target,
  TrendingDown,
  DollarSign,
  Wallet,
  BarChart3,
  Calculator,
  Upload,
} from "lucide-react";

export function GenericDashboard() {
  const { user, wealthManager } = useAuth();
  const { data: wealthManagers, isLoading: isLoadingWM } = useWealthManagers();
  const { data: clients, isLoading: isLoadingClients } = useClients();
  const { data: holdings } = useHoldings();
  const { data: tlhOpportunities } = useTLHOpportunities();

  if (isLoadingWM || isLoadingClients) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Determine client type from user data
  const clientType = wealthManager ? "wealth_manager" : "individual";
  const currentWM = wealthManagers?.results?.[0];

  // Calculate portfolio metrics for individual investors
  const totalPortfolioValue =
    holdings?.results?.reduce((sum, holding) => {
      return (
        sum + holding.current_price * (holding.section104_pool?.pooled_qty || 0)
      );
    }, 0) || 0;

  const totalHoldings =
    holdings?.results?.filter((h) => (h.section104_pool?.pooled_qty || 0) > 0)
      .length || 0;

  const potentialTaxSavings =
    tlhOpportunities?.results?.reduce((sum, opp) => {
      return sum + Math.abs(opp.unrealised_pnl || 0);
    }, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold">Welcome to APEX</h1>
        {/* <p className="text-blue-100 mt-2">Advanced Tax Optimization Platform</p> */}
        {user && (
          <div className="mt-4">
            <p className="text-lg">
              Hello, {user.first_name} {user.last_name}
            </p>
            {wealthManager?.firm_name && (
              <p className="text-blue-100 text-sm">
                {wealthManager.firm_name} •{" "}
                {clientType.replace("_", " ").toUpperCase()}
              </p>
            )}
            {currentWM && (
              <p className="text-blue-100 text-sm">
                {currentWM.firm_name} • Managing {currentWM.client_count}{" "}
                clients
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main Content Based on Client Type */}
      {clientType === "wealth_manager" ? (
        <WealthManagerView clients={clients?.results || []} />
      ) : (
        <IndividualInvestorView />
      )}
    </div>
  );
}

function WealthManagerView({ clients }: { clients: Client[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Client Portfolio Overview
      </h2>

      {clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client: Client) => (
            <div
              key={client.id}
              className="bg-white shadow overflow-hidden sm:rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-lg font-medium text-indigo-600 hover:text-indigo-900"
                  >
                    {client.first_name} {client.last_name}
                  </Link>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.risk_profile === "AGGRESSIVE"
                        ? "bg-red-100 text-red-800"
                        : client.risk_profile === "MODERATE"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {client.risk_profile}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{client.email}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Holdings:</span>
                    <span className="font-medium">{client.holding_count}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Portfolio Value:</span>
                    <span className="font-medium">
                      {formatCurrency(client.total_portfolio_value)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Unrealised P&L:</span>
                    <span
                      className={`font-medium ${
                        (client.total_unrealised_pnl || 0) < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatCurrency(client.total_unrealised_pnl || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6">
                <Link
                  href={`/clients/${client.id}/tlh`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                >
                  View TLH Opportunities &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center text-gray-500">
          <p>No clients managed yet. Add your first client to get started!</p>
          <Link
            href="/clients/new"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add New Client
          </Link>
        </div>
      )}
    </div>
  );
}

function IndividualInvestorView() {
  const { data: holdings } = useHoldings();
  const { data: tlhOpportunities } = useTLHOpportunities();
  const { data: tlhExecutions } = useTLHExecutions();

  // Calculate portfolio metrics from real data
  const totalPortfolioValue =
    holdings?.results?.reduce((sum, holding) => {
      return (
        sum + holding.current_price * (holding.section104_pool?.pooled_qty || 0)
      );
    }, 0) || 0;

  const totalUnrealisedPnl =
    holdings?.results?.reduce((sum, holding) => {
      return sum + (holding.unrealised_pnl || 0);
    }, 0) || 0;

  const activeHoldings =
    holdings?.results?.filter((h) => (h.section104_pool?.pooled_qty || 0) > 0)
      .length || 0;

  // Calculate total unrealised losses available for TLH
  const totalUnrealisedLosses =
    tlhOpportunities?.results?.reduce((sum, opp) => {
      return sum + Math.abs(opp.unrealised_pnl || 0);
    }, 0) || 0;

  // Calculate actual tax benefit (20% of losses for UK higher rate taxpayers)
  const potentialTaxSavings = totalUnrealisedLosses * 0.2;

  const opportunitiesCount = tlhOpportunities?.results?.length || 0;

  // Calculate total tax savings from executed TLH trades
  const totalTaxSavings =
    tlhExecutions?.results
      ?.filter((execution) => execution.status === "EXECUTED")
      .reduce((sum, execution) => sum + Number(execution.tax_benefit), 0) || 0;

  const executedTradesCount =
    tlhExecutions?.results?.filter(
      (execution) => execution.status === "EXECUTED"
    ).length || 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/holdings">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-center h-full">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4 flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-600">
                  Portfolio Value
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalPortfolioValue)}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/holdings">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-center h-full">
              <div className="p-2 bg-purple-100 rounded-lg">
                <PieChart className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4 flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-600">Holdings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeHoldings}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/reports">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-center h-full">
              <div className="p-2 bg-red-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4 flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-600">
                  Unrealised P&L
                </p>
                <p
                  className={`text-2xl font-bold ${
                    totalUnrealisedPnl < 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatCurrency(totalUnrealisedPnl)}
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Tax Optimization Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/tlh">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-center h-full">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4 flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-600">
                  TLH Opportunities
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {opportunitiesCount}
                </p>
                <div className="h-4"></div> {/* Spacer to match other cards */}
              </div>
            </div>
          </div>
        </Link>

        <Link href="/tlh">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-center h-full">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calculator className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4 flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-600">
                  Potential Tax Savings
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(potentialTaxSavings)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  20% out of {formatCurrency(totalUnrealisedLosses)} total
                  losses
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/tlh-executions">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="flex items-center h-full">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4 flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-600">
                  Total Tax Savings
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalTaxSavings)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  From {executedTradesCount} executed APEX trades
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* TLH Opportunities Alert */}
      {opportunitiesCount > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Target className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-medium text-yellow-800">
                Tax Loss Harvesting Alert
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                <strong>{opportunitiesCount} opportunities found</strong> -
                Potential tax savings of{" "}
                <strong>{formatCurrency(potentialTaxSavings)}</strong> through
                strategic loss harvesting.
              </p>
            </div>
            <div className="ml-4">
              <Link
                href="/tlh"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Review Opportunities
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Quick Actions
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/holdings"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 ring-4 ring-white">
                  <PieChart className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">View Holdings</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Review your current portfolio and Section 104 pools
                </p>
              </div>
            </Link>

            <Link
              href="/reports"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                  <Target className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">Generate Reports</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Create CGT reports and tax optimization summaries
                </p>
              </div>
            </Link>

            <Link
              href="/upload"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                  <Upload className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">Upload Data</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Import your portfolio data via CSV
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
