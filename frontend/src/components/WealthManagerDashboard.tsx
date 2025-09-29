"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useClients } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  TrendingDown,
  FileText,
  Upload,
  Building2,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Download,
} from "lucide-react";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  risk_profile: string;
  total_portfolio_value: number;
  holding_count: number;
  total_unrealised_pnl: number;
}

interface TLHOpportunity {
  holding_id: string;
  ticker: string;
  name: string;
  unrealised_pnl: number;
  unrealised_pnl_pct: number;
  score: number;
  eligible: boolean;
  reason: string;
}

export function WealthManagerDashboard() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Fetch clients
  const { data: clientsData, isLoading: clientsLoading } =
    useClients(isAuthenticated);

  // Fetch TLH opportunities for selected client
  const { data: tlhData, isLoading: tlhLoading } = useQuery({
    queryKey: ["tlh-opportunities", selectedClient],
    queryFn: () => apiClient.getTLHOpportunities(),
    enabled: !!selectedClient,
  });

  const clients = clientsData?.results || [];
  const tlhOpportunities = tlhData?.results || [];

  // Calculate summary statistics
  const totalClients = clients.length;
  const totalPortfolioValue = clients.reduce(
    (sum, client) => sum + client.total_portfolio_value,
    0
  );
  const totalUnrealisedLoss = clients.reduce(
    (sum, client) => sum + Math.abs(Math.min(0, client.total_unrealised_pnl)),
    0
  );
  const eligibleOpportunities = tlhOpportunities.filter((opp) => opp.eligible);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Financial Advisor Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your clients' portfolios and TLH opportunities
          </p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900">
                {clientsLoading ? "..." : totalClients}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Portfolio Value
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {clientsLoading
                  ? "..."
                  : `£${totalPortfolioValue.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Unrealised Loss
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {clientsLoading
                  ? "..."
                  : `£${totalUnrealisedLoss.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Eligible TLH Opportunities
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {tlhLoading ? "..." : eligibleOpportunities.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Client Portfolio Overview
          </h2>
          <p className="text-gray-600 mt-1">
            Click on a client to view their TLH opportunities
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Portfolio Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Holdings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unrealised P&L
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientsLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Loading clients...
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedClient === client.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedClient(client.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {client.first_name} {client.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {client.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          client.risk_profile === "AGGRESSIVE"
                            ? "bg-red-100 text-red-800"
                            : client.risk_profile === "MODERATE"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {client.risk_profile}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      £{client.total_portfolio_value.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.holding_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`text-sm font-medium ${
                          client.total_unrealised_pnl >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        £{client.total_unrealised_pnl.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="text-green-600 hover:text-green-900">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TLH Opportunities for Selected Client */}
      {selectedClient && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              TLH Opportunities
            </h2>
            <p className="text-gray-600 mt-1">
              Tax loss harvesting opportunities for selected client
            </p>
          </div>

          <div className="p-6">
            {tlhLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading TLH opportunities...</p>
              </div>
            ) : tlhOpportunities.length === 0 ? (
              <div className="text-center py-8">
                <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No TLH opportunities found
                </h3>
                <p className="text-gray-600">
                  No tax loss harvesting opportunities available for this client
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tlhOpportunities.map((opportunity, index) => (
                  <div
                    key={opportunity.holding_id}
                    className={`p-4 rounded-lg border-2 ${
                      opportunity.eligible
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-sm font-medium text-gray-500 mr-2">
                            #{index + 1}
                          </span>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {opportunity.ticker} - {opportunity.name}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-600">
                              Unrealised Loss
                            </p>
                            <p className="text-lg font-semibold text-red-600">
                              £
                              {Math.abs(
                                opportunity.unrealised_pnl
                              ).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Loss %</p>
                            <p className="text-lg font-semibold text-red-600">
                              {Math.abs(opportunity.unrealised_pnl_pct).toFixed(
                                1
                              )}
                              %
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Score</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {opportunity.score.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Status</p>
                            <div
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                opportunity.eligible
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {opportunity.eligible ? "Eligible" : "Blocked"}
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-1">
                            Explanation
                          </p>
                          <p className="text-sm text-gray-800">
                            {opportunity.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
