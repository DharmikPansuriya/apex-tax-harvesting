"use client";

import { useState } from "react";
import { formatCurrency } from "@/utils/format";
import { useHoldings } from "@/hooks/useApi";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

export function HoldingsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: holdingsData, isLoading, error } = useHoldings();

  const holdings = holdingsData?.results || [];

  // Filter holdings based on search term
  const filteredHoldings = holdings.filter(
    (holding) =>
      holding.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      holding.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Holdings</h1>
        <p className="text-gray-600 mt-2">
          Portfolio holdings and Section 104 pool status
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

      {/* Holdings Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading holdings...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Error loading holdings</p>
          </div>
        ) : filteredHoldings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No holdings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pooled Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Market Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unrealised P/L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eligible
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHoldings.map((holding) => {
                  const pool = holding.section104_pool;
                  const pooledQty = pool?.pooled_qty ?? 0;
                  const avgCost = pool?.avg_cost ?? 0;
                  const currentPrice = holding.current_price;
                  const unrealisedPnl = holding.unrealised_pnl;
                  const unrealisedPnlPct = holding.unrealised_pnl_pct;

                  // Determine if eligible for TLH (has unrealised loss and pooled quantity)
                  const isEligible = unrealisedPnl < 0 && pooledQty > 0;

                  return (
                    <tr key={holding.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {holding.ticker}
                        </div>
                        <div className="text-sm text-gray-500">
                          {holding.isin}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {holding.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {pooledQty.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(Number(avgCost))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(Number(currentPrice))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {unrealisedPnl >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                          )}
                          <div>
                            <div
                              className={`text-sm font-medium ${
                                unrealisedPnl >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(Number(unrealisedPnl))}
                            </div>
                            <div
                              className={`text-xs ${
                                unrealisedPnl >= 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {unrealisedPnlPct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            isEligible
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {isEligible ? "Eligible" : "Not Eligible"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {/* {holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Holdings
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {holdings.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Eligible for TLH
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {
                holdings.filter(
                  (h) =>
                    h.unrealised_pnl < 0 && h.section104_pool?.pooled_qty > 0
                ).length
              }
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Unrealised Loss
            </h3>
            <p className="text-3xl font-bold text-red-600">
              £
              {holdings
                .filter((h) => h.unrealised_pnl < 0)
                .reduce((sum, h) => sum + Math.abs(h.unrealised_pnl), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
      )} */}
    </div>
  );
}
