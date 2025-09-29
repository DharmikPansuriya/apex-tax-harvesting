"use client";

import { useState } from "react";
import { formatCurrency } from "@/utils/format";
import { useTLHOpportunities } from "@/hooks/useApi";
import {
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";

export function TLHPage() {
  const [filter, setFilter] = useState<"all" | "eligible" | "blocked">("all");
  const { data: tlhData, isLoading, error } = useTLHOpportunities();

  const opportunities = tlhData?.results || [];

  // Filter opportunities based on selected filter
  const filteredOpportunities = opportunities.filter((opportunity) => {
    if (filter === "eligible") return opportunity.eligible;
    if (filter === "blocked") return !opportunity.eligible;
    return true;
  });

  // Sort by score (highest first)
  const sortedOpportunities = [...filteredOpportunities].sort(
    (a, b) => b.score - a.score
  );

  const getPriority = (score: number) => {
    if (score >= 70) return { label: "High", color: "bg-red-100 text-red-800" };
    if (score >= 40)
      return { label: "Medium", color: "bg-amber-100 text-amber-800" };
    return { label: "Low", color: "bg-gray-100 text-gray-800" };
  };

  const getActionHint = (
    eligible: boolean,
    blockedMsg?: string,
    score?: number
  ) => {
    if (!eligible && blockedMsg) {
      return `Wait: ${blockedMsg}`;
    }
    if ((score ?? 0) >= 70) {
      return "Consider harvesting and switch to a similar, not identical, security";
    }
    if ((score ?? 0) >= 40) {
      return "Evaluate harvesting; compare to other candidates first";
    }
    return "Monitor for now; reassess if loss grows";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">TLH Opportunities</h1>
        <p className="text-gray-600 mt-2">
          Tax Loss Harvesting candidates ranked by potential
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            {
              key: "all",
              label: "All Opportunities",
              count: opportunities.length,
            },
            {
              key: "eligible",
              label: "Eligible",
              count: opportunities.filter((o) => o.eligible).length,
            },
            {
              key: "blocked",
              label: "Blocked",
              count: opportunities.filter((o) => !o.eligible).length,
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
              {tab.label}
              <span
                className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  filter === tab.key
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading TLH opportunities...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Error loading TLH opportunities</p>
          </div>
        ) : sortedOpportunities.length === 0 ? (
          <div className="text-center py-12">
            <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No opportunities found
            </h3>
            <p className="text-gray-600">
              {filter === "all"
                ? "No tax loss harvesting opportunities available"
                : `No ${filter} opportunities found`}
            </p>
          </div>
        ) : (
          sortedOpportunities.map((opportunity, index) => (
            <div
              key={opportunity.holding_id}
              className={`p-6 rounded-lg border-2 ${
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
                    <h3 className="text-xl font-semibold text-gray-900">
                      {opportunity.ticker} - {opportunity.name}
                    </h3>
                    {/* Priority badge */}
                    <span
                      className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${
                        getPriority(opportunity.score).color
                      }`}
                    >
                      Priority: {getPriority(opportunity.score).label}
                    </span>
                    <div className="ml-3">
                      {opportunity.eligible ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Unrealised Loss</p>
                      <p className="text-lg font-semibold text-red-600">
                        {formatCurrency(Math.abs(opportunity.unrealised_pnl))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Loss Percentage</p>
                      <p className="text-lg font-semibold text-red-600">
                        {Math.abs(opportunity.unrealised_pnl_pct).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Investment</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(
                          opportunity.avg_cost * opportunity.pooled_qty
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Value</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(
                          opportunity.current_price * opportunity.pooled_qty
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <p className="text-sm text-blue-800">
                      {getActionHint(
                        opportunity.eligible,
                        opportunity?.constraints?.thirty_day_rule?.message,
                        opportunity.score
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Rank {index + 1} of {sortedOpportunities.length}
                    </p>
                  </div>

                  {!opportunity.eligible &&
                    opportunity.constraints.thirty_day_rule.blocked && (
                      <div className="flex items-start p-3 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            30-Day Rule Constraint
                          </p>
                          <p className="text-sm text-red-700">
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
                      </div>
                    )}
                </div>

                <div className="ml-6 text-right">
                  <p className="text-sm text-gray-600">TLH Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {opportunity.score.toFixed(1)}
                  </p>
                  <div
                    className={`mt-3 px-3 py-1 rounded-full text-sm font-medium ${
                      opportunity.eligible
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {opportunity.eligible ? "Eligible" : "Blocked"}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {opportunities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Opportunities
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {opportunities.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Eligible
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {opportunities.filter((o) => o.eligible).length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Blocked
            </h3>
            <p className="text-3xl font-bold text-red-600">
              {opportunities.filter((o) => !o.eligible).length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Loss Potential
            </h3>
            <p className="text-3xl font-bold text-orange-600">
              £
              {opportunities
                .filter((o) => o.eligible)
                .reduce((sum, o) => sum + Math.abs(o.unrealised_pnl), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              About Tax Loss Harvesting
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p className="text-xs text-blue-700">
                Score legend: 0–100 within today’s candidates (100 = strongest
                TLH candidate today; 0 = weakest).
              </p>
              <p>
                Tax Loss Harvesting (TLH) allows you to realize capital losses
                to offset capital gains, reducing your overall tax liability.
              </p>
              <p>
                <strong>UK CGT Rules:</strong> The 30-day rule prevents you from
                repurchasing the same security within 30 days of selling it, or
                the loss will be disallowed.
              </p>
              <p>
                <strong>Section 104 Pooling:</strong> All shares of the same
                class are pooled together, with disposals costed at the average
                cost from the pool.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
