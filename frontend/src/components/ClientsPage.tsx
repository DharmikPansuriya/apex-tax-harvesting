"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useClients } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Plus,
  Eye,
  Download,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Building2,
} from "lucide-react";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  risk_profile: string;
  total_portfolio_value: number;
  holding_count: number;
  total_unrealised_pnl: number;
  created_at: string;
}

export function ClientsPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const { userProfile, isAuthenticated } = useAuth();

  // Check if user is a financial advisor (can create clients)
  const canCreateClients =
    userProfile?.client_type === "wealth_manager" ||
    userProfile?.client_type === "financial_advisor";

  const { data: clientsData, isLoading, error } = useClients(isAuthenticated);

  const clients = clientsData?.results || [];

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
  const totalHoldings = clients.reduce(
    (sum, client) => sum + client.holding_count,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {canCreateClients ? "Client Management" : "My Portfolio"}
          </h1>
          <p className="text-gray-600 mt-2">
            {canCreateClients
              ? "Manage your clients' portfolios and investment strategies"
              : "View and manage your personal investment portfolio"}
          </p>
        </div>
        {canCreateClients && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </button>
        )}
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
                {isLoading ? "..." : totalClients}
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
                {isLoading ? "..." : `£${totalPortfolioValue.toLocaleString()}`}
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
                {isLoading ? "..." : `£${totalUnrealisedLoss.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Holdings
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? "..." : totalHoldings}
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
            Click on a client to view their detailed portfolio information
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
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Loading clients...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-red-500"
                  >
                    Error loading clients
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No clients found
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
                      <div className="flex items-center">
                        {client.total_unrealised_pnl >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            client.total_unrealised_pnl >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          £{client.total_unrealised_pnl.toLocaleString()}
                        </span>
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

      {/* Client Details Panel */}
      {selectedClient && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Client Details
            </h2>
            <p className="text-gray-600 mt-1">
              Detailed information for selected client
            </p>
          </div>

          <div className="p-6">
            {(() => {
              const client = clients.find((c) => c.id === selectedClient);
              if (!client) return null;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Personal Information
                    </h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Name
                        </dt>
                        <dd className="text-sm text-gray-900">
                          {client.first_name} {client.last_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Email
                        </dt>
                        <dd className="text-sm text-gray-900">
                          {client.email}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Phone
                        </dt>
                        <dd className="text-sm text-gray-900">
                          {client.phone}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Risk Profile
                        </dt>
                        <dd className="text-sm text-gray-900">
                          {client.risk_profile}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Portfolio Summary
                    </h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Total Portfolio Value
                        </dt>
                        <dd className="text-sm text-gray-900">
                          £{client.total_portfolio_value.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Number of Holdings
                        </dt>
                        <dd className="text-sm text-gray-900">
                          {client.holding_count}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Unrealised P&L
                        </dt>
                        <dd
                          className={`text-sm font-medium ${
                            client.total_unrealised_pnl >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          £{client.total_unrealised_pnl.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Client Since
                        </dt>
                        <dd className="text-sm text-gray-900">
                          {new Date(client.created_at).toLocaleDateString()}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
