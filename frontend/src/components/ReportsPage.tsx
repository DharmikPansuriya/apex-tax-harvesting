"use client";

import { useState } from "react";
import { useCGTReports, useGenerateCGTReport } from "@/hooks/useApi";
import { FileText, Download, Plus, Calendar } from "lucide-react";

export function ReportsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [selectedTaxYear, setSelectedTaxYear] = useState("2024-25");
  const { data: reportsData, isLoading, error } = useCGTReports();
  const generateReport = useGenerateCGTReport();

  const reports = reportsData?.results || [];

  const handleGenerateReport = async () => {
    try {
      await generateReport.mutateAsync(selectedTaxYear);
    } catch (error) {
      console.error("Error generating report:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CGT Reports</h1>
          <p className="text-gray-600 mt-2">
            Capital Gains Tax reports and downloads
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-black" />
            <select
              value={selectedTaxYear}
              onChange={(e) => setSelectedTaxYear(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            >
              <option value="2024-25">2024-25</option>
              <option value="2023-24">2023-24</option>
              <option value="2022-23">2022-23</option>
            </select>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generateReport.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateReport.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading reports...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Error loading reports</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No reports generated
            </h3>
            <p className="text-gray-600 mb-4">
              Generate your first CGT report to get started
            </p>
            <button
              onClick={handleGenerateReport}
              disabled={generateReport.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reports.map((report) => (
              <div key={report.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        CGT Report {report.tax_year}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Generated on{" "}
                        {new Date(report.created_at).toLocaleDateString(
                          "en-GB",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Report Summary */}
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="font-medium">Net Gains:</span>
                            <br />
                            <span
                              className={
                                report.totals.net_gains >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              £{report.totals.net_gains.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Taxable Gains:</span>
                            <br />
                            <span className="text-gray-900">
                              £{report.totals.taxable_gains.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">AEA Applied:</span>
                            <br />
                            <span className="text-gray-900">
                              £{report.totals.annual_exempt_amount.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Carry Forward:</span>
                            <br />
                            <span className="text-gray-900">
                              £{report.totals.carry_forward_losses.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Download Buttons */}
                    <div className="flex space-x-2">
                      {report.csv_url && (
                        <a
                          href={`${apiBase}${report.csv_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </a>
                      )}
                      {report.pdf_url && (
                        <a
                          href={`${apiBase}${report.pdf_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Disposals:</span>
                      <p className="font-medium text-gray-900">
                        {report.totals.total_disposals}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Proceeds:</span>
                      <p className="font-medium text-gray-900">
                        £{report.totals.total_proceeds.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Cost:</span>
                      <p className="font-medium text-gray-900">
                        £{report.totals.total_cost.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Disallowed Losses:</span>
                      <p className="font-medium text-red-600">
                        £{report.totals.disallowed_losses.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Reports
            </h3>
            <p className="text-3xl font-bold text-blue-600">{reports.length}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Latest Tax Year
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {reports[0]?.tax_year || "N/A"}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Disposals
            </h3>
            <p className="text-3xl font-bold text-purple-600">
              {reports.reduce((sum, r) => sum + r.totals.total_disposals, 0)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Total Taxable Gains
            </h3>
            <p className="text-3xl font-bold text-orange-600">
              £
              {reports
                .reduce((sum, r) => sum + r.totals.taxable_gains, 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
