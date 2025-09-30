"use client";

import { useState } from "react";
import { formatCurrency } from "@/utils/format";
import { formatDateTime } from "@/lib/utils";
import { useTLHExecutions, useExecuteTLH, useCancelTLH } from "@/hooks/useApi";
import { TLHExecution } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  Play,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  TrendingDown,
  TrendingUp,
  Search,
} from "lucide-react";

export function TLHExecutionsPage() {
  const [filter, setFilter] = useState<
    "all" | "pending" | "executed" | "cancelled"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    data: executionsData,
    isLoading,
    error,
  } = useTLHExecutions(isAuthenticated && !authLoading);
  const executeTLHMutation = useExecuteTLH();
  const cancelTLHMutation = useCancelTLH();

  const executions = executionsData?.results || [];

  // Filter executions based on selected filter and search term
  const filteredExecutions = executions.filter((execution) => {
    // Status filter
    if (filter === "pending" && execution.status !== "PENDING") return false;
    if (filter === "executed" && execution.status !== "EXECUTED") return false;
    if (filter === "cancelled" && execution.status !== "CANCELLED")
      return false;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        execution.holding_ticker.toLowerCase().includes(searchLower) ||
        execution.holding_name.toLowerCase().includes(searchLower) ||
        (execution.replacement_ticker &&
          execution.replacement_ticker.toLowerCase().includes(searchLower)) ||
        (execution.replacement_name &&
          execution.replacement_name.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "EXECUTED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "CANCELLED":
        return <X className="h-4 w-4 text-gray-600" />;
      case "FAILED":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "EXECUTED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleExecute = async (executionId: string) => {
    try {
      await executeTLHMutation.mutateAsync(executionId);
    } catch (error) {
      console.error("Failed to execute TLH:", error);
    }
  };

  const handleCancel = async (executionId: string) => {
    try {
      await cancelTLHMutation.mutateAsync(executionId);
    } catch (error) {
      console.error("Failed to cancel TLH:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <p className="text-red-800">Error loading TLH executions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">TLH Executions</h1>
        <p className="text-gray-600 mt-2">
          Track and manage your tax loss harvesting executions
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by ticker or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: "all", label: "All", count: executions.length },
            {
              key: "pending",
              label: "Pending",
              count: executions.filter((e) => e.status === "PENDING").length,
            },
            {
              key: "executed",
              label: "Executed",
              count: executions.filter((e) => e.status === "EXECUTED").length,
            },
            {
              key: "cancelled",
              label: "Cancelled",
              count: executions.filter((e) => e.status === "CANCELLED").length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Executions Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {authLoading || isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading TLH executions...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Error loading TLH executions</p>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="text-center py-12">
            <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No TLH executions found
            </h3>
            <p className="text-gray-600">
              {filter === "all"
                ? "You haven't created any TLH executions yet."
                : `No ${filter} executions found.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Security
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction Summary
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax Benefit
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Replacement
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExecutions.map((execution) => (
                  <tr key={execution.id} className="hover:bg-gray-50">
                    {/* Security */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {execution.holding_ticker}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {execution.holding_name}
                        </div>
                      </div>
                    </td>

                    {/* Transaction Summary */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-blue-600 border-b-2 border-blue-600 pb-1 text-center">
                          {execution.original_qty_display.toLocaleString()}{" "}
                          shares sold
                        </div>
                        <div className="text-xs text-gray-600">
                          Bought @{" "}
                          {formatCurrency(execution.original_avg_cost_display)}
                        </div>
                        <div className="text-xs text-gray-600">
                          Sold @{" "}
                          {execution.sell_price_display
                            ? formatCurrency(execution.sell_price_display)
                            : "N/A"}
                        </div>
                        <div className="text-xs text-blue-600 font-medium">
                          Initial Investment:{" "}
                          {formatCurrency(
                            Number(execution.original_investment)
                          )}
                        </div>
                        <div className="text-xs text-green-600 font-medium">
                          Proceeds:{" "}
                          {formatCurrency(Number(execution.sale_proceeds))}
                        </div>
                        <div className="text-xs text-red-600 font-medium">
                          Loss:{" "}
                          {formatCurrency(
                            Math.abs(Number(execution.realised_loss))
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tax Benefit */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(Number(execution.tax_benefit))}
                        </div>
                        <div className="text-xs text-gray-500">Tax saved</div>
                        <div className="text-xs text-gray-400">
                          Net loss:{" "}
                          {formatCurrency(Number(execution.net_loss_after_tax))}
                        </div>
                      </div>
                    </td>
                    {/* Replacement */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {execution.replacement_ticker ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-green-800">
                            {execution.replacement_ticker}
                          </div>
                          <div className="text-sm font-bold text-green-600 border-b-2 border-green-600 pb-1 text-center">
                            {execution.replacement_qty_display?.toLocaleString()}{" "}
                            shares bought
                          </div>
                          <div className="text-xs text-gray-600">
                            Bought @{" "}
                            {execution.replacement_price_display
                              ? formatCurrency(
                                  execution.replacement_price_display
                                )
                              : "N/A"}
                          </div>
                          <div className="text-xs text-blue-600 font-medium">
                            Investment:{" "}
                            {formatCurrency(
                              Number(execution.replacement_investment)
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                      {execution.status === "PENDING" && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleExecute(execution.id)}
                            disabled={executeTLHMutation.isPending}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {executeTLHMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Play className="h-3 w-3 mr-1" />
                            )}
                            Execute
                          </button>
                          <button
                            onClick={() => handleCancel(execution.id)}
                            disabled={cancelTLHMutation.isPending}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {cancelTLHMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <X className="h-3 w-3 mr-1" />
                            )}
                            Cancel
                          </button>
                        </div>
                      )}
                      {execution.status === "EXECUTED" && (
                        <div className="text-center">
                          <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                          <div className="text-xs text-green-600 font-medium">
                            Executed
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(execution.updated_at)}
                          </div>
                        </div>
                      )}
                      {execution.status === "CANCELLED" && (
                        <div className="text-center">
                          <X className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                          <div className="text-xs text-gray-600 font-medium">
                            Cancelled
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(execution.updated_at)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {executions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Executions
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {executions.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Pending
            </h3>
            <p className="text-3xl font-bold text-yellow-600">
              {executions.filter((e) => e.status === "PENDING").length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Executed
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {executions.filter((e) => e.status === "EXECUTED").length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Tax Savings
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(
                executions
                  .filter((e) => e.status === "EXECUTED")
                  .reduce((sum, e) => sum + Number(e.tax_benefit), 0)
              )}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              From {executions.filter((e) => e.status === "EXECUTED").length}{" "}
              executed APEX trades
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
