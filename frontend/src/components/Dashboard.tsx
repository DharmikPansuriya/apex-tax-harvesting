"use client";

import {
  useTLHOpportunities,
  useCGTReports,
  useHoldings,
} from "@/hooks/useApi";
import { TrendingDown, FileText, Building2, AlertTriangle } from "lucide-react";

export function Dashboard() {
  const {
    data: tlhData,
    isLoading: tlhLoading,
    error: tlhError,
  } = useTLHOpportunities();
  const { data: reportsData, isLoading: reportsLoading } = useCGTReports();
  const { data: holdingsData, isLoading: holdingsLoading } = useHoldings();

  const tlhOpportunities = tlhData?.results || [];
  const reports = reportsData?.results || [];
  const holdings = holdingsData?.results || [];

  // Calculate summary statistics
  const eligibleOpportunities = tlhOpportunities.filter((opp) => opp.eligible);
  const blockedOpportunities = tlhOpportunities.filter((opp) => !opp.eligible);
  const totalUnrealisedLoss = tlhOpportunities.reduce(
    (sum, opp) => sum + Math.abs(opp.unrealised_pnl),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">UK Tax Loss Harvesting Overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                TLH Opportunities
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {tlhLoading ? "..." : eligibleOpportunities.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                30-Day Blocked
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {tlhLoading ? "..." : blockedOpportunities.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Holdings
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {holdingsLoading ? "..." : holdings.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">CGT Reports</p>
              <p className="text-2xl font-bold text-gray-900">
                {reportsLoading ? "..." : reports.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TLH Opportunities Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            TLH Opportunities
          </h2>
          <p className="text-gray-600 mt-1">
            Current tax loss harvesting candidates
          </p>
        </div>

        <div className="p-6">
          {tlhLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading opportunities...</p>
            </div>
          ) : tlhError ? (
            <div className="text-center py-8">
              <p className="text-red-600">Error loading TLH opportunities</p>
            </div>
          ) : tlhOpportunities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No TLH opportunities found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tlhOpportunities.slice(0, 5).map((opportunity) => (
                <div
                  key={opportunity.holding_id}
                  className={`p-4 rounded-lg border ${
                    opportunity.eligible
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {opportunity.ticker} - {opportunity.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Unrealised loss: £
                        {Math.abs(opportunity.unrealised_pnl).toFixed(2)}(
                        {Math.abs(opportunity.unrealised_pnl_pct).toFixed(1)}%)
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {opportunity.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          opportunity.eligible
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {opportunity.eligible ? "Eligible" : "Blocked"}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Score: {opportunity.score.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CGT Summary Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            CGT Summary (YTD)
          </h2>
          <p className="text-gray-600 mt-1">2024/25 tax year overview</p>
        </div>

        <div className="p-6">
          {reportsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No CGT reports generated yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Generate a report to see your capital gains tax summary
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.slice(0, 3).map((report) => (
                <div
                  key={report.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        CGT Report {report.tax_year}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Generated:{" "}
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Net Gains:</span> £
                          {report.totals.net_gains.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">
                            Annual Exempt Amount:
                          </span>{" "}
                          £{report.totals.annual_exempt_amount.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Taxable Gains:</span> £
                          {report.totals.taxable_gains.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {report.csv_url && (
                        <a
                          href={report.csv_url}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                        >
                          CSV
                        </a>
                      )}
                      {report.pdf_url && (
                        <a
                          href={report.pdf_url}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 30-Day Watchlist Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            30-Day Watchlist
          </h2>
          <p className="text-gray-600 mt-1">Holdings blocked by 30-day rule</p>
        </div>

        <div className="p-6">
          {blockedOpportunities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                No holdings currently blocked by 30-day rule
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {blockedOpportunities.map((opportunity) => (
                <div
                  key={opportunity.holding_id}
                  className="p-4 border border-red-200 bg-red-50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {opportunity.ticker} - {opportunity.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {opportunity.constraints.thirty_day_rule.message}
                      </p>
                      {opportunity.constraints.thirty_day_rule
                        .days_remaining && (
                        <p className="text-xs text-red-600 mt-1">
                          {
                            opportunity.constraints.thirty_day_rule
                              .days_remaining
                          }{" "}
                          days remaining
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        Blocked
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Loss: £{Math.abs(opportunity.unrealised_pnl).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
