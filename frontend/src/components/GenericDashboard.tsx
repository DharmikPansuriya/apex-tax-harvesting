"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  useClients,
  useWealthManagers,
  useHoldings,
  useTLHOpportunities,
} from "@/hooks/useApi";
import { Client } from "@/types";
import { formatCurrency } from "@/utils/format";
import Link from "next/link";
import { TrendingUp, Users, PieChart, Target } from "lucide-react";

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                TLH Opportunities
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {clientType === "wealth_manager"
                  ? tlhOpportunities?.results?.length || 0
                  : tlhOpportunities?.results?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {clientType === "wealth_manager"
                  ? "Clients"
                  : "Portfolio Value"}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {clientType === "wealth_manager"
                  ? clients?.results?.length || 0
                  : formatCurrency(totalPortfolioValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PieChart className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Holdings</p>
              <p className="text-2xl font-bold text-gray-900">
                {clientType === "wealth_manager"
                  ? clients?.results?.reduce(
                      (acc: number, client: Client) =>
                        acc + (client.holding_count || 0),
                      0
                    ) || 0
                  : totalHoldings}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Target className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tax Savings</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(potentialTaxSavings)}
              </p>
            </div>
          </div>
        </div>
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

  const potentialSavings =
    tlhOpportunities?.results?.reduce((sum, opp) => {
      return sum + Math.abs(opp.unrealised_pnl || 0);
    }, 0) || 0;

  const opportunitiesCount = tlhOpportunities?.results?.length || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Your Tax Optimization Dashboard
      </h2>

      {/* Portfolio Overview */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Portfolio Summary
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Portfolio Value
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(totalPortfolioValue)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Unrealised P&L
                      </dt>
                      <dd
                        className={`text-lg font-medium ${
                          totalUnrealisedPnl < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {formatCurrency(totalUnrealisedPnl)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <PieChart className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Holdings
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {activeHoldings}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TLH Opportunities */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Tax Loss Harvesting Opportunities
          </h3>
          <div className="mt-5">
            {opportunitiesCount > 0 ? (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>{opportunitiesCount} opportunities found</strong>{" "}
                      - Potential savings of {formatCurrency(potentialSavings)}{" "}
                      through strategic loss harvesting. Review your holdings to
                      optimize your tax position.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-gray-700">
                      No tax loss harvesting opportunities found at this time.
                      Monitor your portfolio for potential opportunities.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4">
              <Link
                href="/tlh"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                View All Opportunities
              </Link>
            </div>
          </div>
        </div>
      </div>

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
                  <TrendingUp className="h-6 w-6" />
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
