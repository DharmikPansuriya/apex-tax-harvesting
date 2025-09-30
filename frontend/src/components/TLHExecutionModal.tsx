"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/utils/format";
import {
  useCreateTLHExecution,
  useReplacementSuggestions,
} from "@/hooks/useApi";
import { TLHOpportunity, ReplacementSuggestion } from "@/types";
import {
  X,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Search,
  ExternalLink,
} from "lucide-react";

interface TLHExecutionModalProps {
  opportunity: TLHOpportunity;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TLHExecutionModal({
  opportunity,
  isOpen,
  onClose,
  onSuccess,
}: TLHExecutionModalProps) {
  const [step, setStep] = useState<"details" | "replacement" | "confirm">(
    "details"
  );
  const [sellPrice, setSellPrice] = useState<number>(opportunity.current_price);
  const [sellFees, setSellFees] = useState<number>(0);
  const [replacementTicker, setReplacementTicker] = useState<string>("");
  const [replacementName, setReplacementName] = useState<string>("");
  const [replacementQty, setReplacementQty] = useState<number>(0);
  const [replacementPrice, setReplacementPrice] = useState<number>(0);
  const [replacementFees, setReplacementFees] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const createTLHMutation = useCreateTLHExecution();
  const { data: suggestions, isLoading: suggestionsLoading } =
    useReplacementSuggestions(opportunity.holding_id, showSuggestions);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("details");
      setSellPrice(opportunity.current_price);
      setSellFees(0);
      setReplacementTicker("");
      setReplacementName("");
      setReplacementQty(0);
      setReplacementPrice(0);
      setReplacementFees(0);
      setNotes("");
      setShowSuggestions(false);
    }
  }, [isOpen, opportunity.current_price]);

  const handleNext = () => {
    if (step === "details") {
      setStep("replacement");
    } else if (step === "replacement") {
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (step === "replacement") {
      setStep("details");
    } else if (step === "confirm") {
      setStep("replacement");
    }
  };

  const handleExecute = async () => {
    try {
      const executionData = {
        holding_id: opportunity.holding_id,
        sell_price: sellPrice,
        sell_fees: sellFees,
        replacement_ticker: replacementTicker || undefined,
        replacement_name: replacementName || undefined,
        replacement_qty: replacementQty || undefined,
        replacement_price: replacementPrice || undefined,
        replacement_fees: replacementFees,
        notes: notes,
      };

      await createTLHMutation.mutateAsync(executionData);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to create TLH execution:", error);
    }
  };

  const selectReplacement = (suggestion: ReplacementSuggestion) => {
    setReplacementTicker(suggestion.ticker);
    setReplacementName(suggestion.name);
    setReplacementPrice(suggestion.current_price);
    setShowSuggestions(false);
  };

  const calculateNetProceeds = () => {
    return sellPrice * opportunity.pooled_qty - sellFees;
  };

  const calculateReplacementCost = () => {
    if (replacementQty && replacementPrice) {
      return replacementQty * replacementPrice + replacementFees;
    }
    return 0;
  };

  const calculateRealisedLoss = () => {
    return (
      (opportunity.avg_cost - sellPrice) * opportunity.pooled_qty - sellFees
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Execute Tax Loss Harvesting
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {opportunity.ticker} - {opportunity.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-4">
            {[
              { key: "details", label: "Details", icon: TrendingDown },
              { key: "replacement", label: "Replacement", icon: Search },
              { key: "confirm", label: "Confirm", icon: CheckCircle },
            ].map((stepItem, index) => {
              const Icon = stepItem.icon;
              const isActive = step === stepItem.key;
              const isCompleted =
                (stepItem.key === "details" && step !== "details") ||
                (stepItem.key === "replacement" && step === "confirm");

              return (
                <div key={stepItem.key} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      isActive ? "text-blue-600" : "text-gray-600"
                    }`}
                  >
                    {stepItem.label}
                  </span>
                  {index < 2 && <div className="w-8 h-px bg-gray-200 mx-4" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "details" && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                  <h3 className="text-lg font-semibold text-red-800">
                    Current Position
                  </h3>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-red-600">Quantity</p>
                    <p className="text-lg font-semibold text-red-800">
                      {opportunity.pooled_qty.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-red-600">Avg Cost</p>
                    <p className="text-lg font-semibold text-red-800">
                      {formatCurrency(opportunity.avg_cost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-red-600">Current Price</p>
                    <p className="text-lg font-semibold text-red-800">
                      {formatCurrency(opportunity.current_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-red-600">Unrealised Loss</p>
                    <p className="text-lg font-semibold text-red-800">
                      {formatCurrency(Math.abs(opportunity.unrealised_pnl))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Sale Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sale Price per Share
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={sellPrice}
                      onChange={(e) =>
                        setSellPrice(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Fees
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={sellFees}
                      onChange={(e) =>
                        setSellFees(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Gross Proceeds</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(sellPrice * opportunity.pooled_qty)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net Proceeds</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(calculateNetProceeds())}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Realised Loss</p>
                      <p className="text-lg font-semibold text-red-600">
                        {formatCurrency(Math.abs(calculateRealisedLoss()))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tax Benefit (20%)</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(
                          Math.abs(calculateRealisedLoss()) * 0.2
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "replacement" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Replacement Security (Optional)
                </h3>
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Get Suggestions
                </button>
              </div>

              {showSuggestions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">
                    Suggested Replacements
                  </h4>
                  {suggestionsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : suggestions && suggestions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestions.map((suggestion) => (
                        <div
                          key={suggestion.ticker}
                          className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                          onClick={() => selectReplacement(suggestion)}
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {suggestion.ticker} - {suggestion.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {suggestion.sector} • {suggestion.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(suggestion.current_price)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {suggestion.market_cap}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-blue-700">No suggestions available</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ticker Symbol
                  </label>
                  <input
                    type="text"
                    value={replacementTicker}
                    onChange={(e) =>
                      setReplacementTicker(e.target.value.toUpperCase())
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., VOD.L"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={replacementName}
                    onChange={(e) => setReplacementName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Vodafone Group"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={replacementQty}
                    onChange={(e) =>
                      setReplacementQty(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price per Share
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={replacementPrice}
                    onChange={(e) =>
                      setReplacementPrice(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Fees
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={replacementFees}
                    onChange={(e) =>
                      setReplacementFees(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {replacementQty && replacementPrice && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">
                    Replacement Cost
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-green-600">Total Cost</p>
                      <p className="text-lg font-semibold text-green-800">
                        {formatCurrency(calculateReplacementCost())}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-green-600">Net Investment</p>
                      <p className="text-lg font-semibold text-green-800">
                        {formatCurrency(
                          calculateReplacementCost() - calculateNetProceeds()
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                  <h3 className="text-lg font-semibold text-yellow-800">
                    Confirm TLH Execution
                  </h3>
                </div>
                <p className="text-yellow-700 mt-2">
                  Please review all details before executing. This action cannot
                  be undone.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-3">
                    Sale Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-red-600">Security:</span>
                      <span className="font-medium">{opportunity.ticker}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Quantity:</span>
                      <span className="font-medium">
                        {opportunity.pooled_qty.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Sale Price:</span>
                      <span className="font-medium">
                        {formatCurrency(sellPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Fees:</span>
                      <span className="font-medium">
                        {formatCurrency(sellFees)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-red-600">Net Proceeds:</span>
                      <span className="font-medium">
                        {formatCurrency(calculateNetProceeds())}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Realised Loss:</span>
                      <span className="font-medium text-red-800">
                        {formatCurrency(Math.abs(calculateRealisedLoss()))}
                      </span>
                    </div>
                  </div>
                </div>

                {replacementTicker && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-3">
                      Replacement Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-600">Security:</span>
                        <span className="font-medium">{replacementTicker}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">Quantity:</span>
                        <span className="font-medium">
                          {replacementQty.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">Price:</span>
                        <span className="font-medium">
                          {formatCurrency(replacementPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">Fees:</span>
                        <span className="font-medium">
                          {formatCurrency(replacementFees)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-green-600">Total Cost:</span>
                        <span className="font-medium">
                          {formatCurrency(calculateReplacementCost())}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes about this TLH execution..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex space-x-3">
            {step !== "details" && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            {step === "confirm" ? (
              <button
                onClick={handleExecute}
                disabled={createTLHMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTLHMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create TLH Execution"
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
