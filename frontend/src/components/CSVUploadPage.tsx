"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useClients, useCSVUploads } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { CSVUpload } from "./CSVUpload";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Users,
} from "lucide-react";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

interface CSVUploadRecord {
  id: string;
  client_name: string;
  filename: string;
  status: string;
  records_processed: number;
  records_successful: number;
  records_failed: number;
  created_at: string;
}

export function CSVUploadPage() {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const { isAuthenticated } = useAuth();

  const { data: clientsData, isLoading: clientsLoading } =
    useClients(isAuthenticated);
  const { data: uploadsData, isLoading: uploadsLoading } =
    useCSVUploads(isAuthenticated);

  const clients = clientsData?.results || [];
  const uploads = uploadsData?.results || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "PROCESSING":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      [
        "ticker",
        "name",
        "sector",
        "quantity",
        "avg_cost",
        "trade_date",
        "side",
        "fees",
      ],
      [
        "AZN.L",
        "AstraZeneca PLC",
        "Pharmaceuticals",
        "100",
        "120.50",
        "2023-01-15",
        "BUY",
        "5.00",
      ],
      [
        "SHEL.L",
        "Shell PLC",
        "Oil & Gas",
        "200",
        "25.80",
        "2023-02-20",
        "BUY",
        "10.00",
      ],
      [
        "ULVR.L",
        "Unilever PLC",
        "Consumer Goods",
        "150",
        "45.20",
        "2023-03-10",
        "BUY",
        "7.50",
      ],
      [
        "DGE.L",
        "Diageo PLC",
        "Beverages",
        "75",
        "35.60",
        "2023-04-05",
        "BUY",
        "3.75",
      ],
    ];

    const csvContent = sampleData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_holdings.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CSV Upload</h1>
            <p className="text-blue-100 mt-2">
              Upload client holdings data from CSV files
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={downloadSampleCSV}
              className="flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              Download Sample CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Client Selection - Compact */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Select Client
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Client
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.first_name} {client.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedClient && (
                <div className="text-center py-4">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Select a client to begin upload
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Component - Takes more space */}
        <div className="xl:col-span-2">
          {selectedClient ? (
            <CSVUpload
              clientId={selectedClient}
              onSuccess={() => {
                // Refresh uploads list
                window.location.reload();
              }}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center">
                <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <Upload className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Ready to Upload Holdings Data
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Select a client from the sidebar to upload their portfolio
                  holdings data. Make sure your CSV file follows the correct
                  format.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={downloadSampleCSV}
                    className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download Sample CSV
                  </button>
                  <button
                    onClick={() => document.querySelector("select")?.focus()}
                    className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Select Client
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Upload History
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Track the status of your CSV uploads
              </p>
            </div>
            {uploads.length > 0 && (
              <div className="text-sm text-gray-500">
                {uploads.length} upload{uploads.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {uploadsLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Loading upload history...
                  </td>
                </tr>
              ) : uploads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <FileText className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No uploads yet
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Start by selecting a client and uploading a CSV file
                      </p>
                      <button
                        onClick={downloadSampleCSV}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download Sample CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                uploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {upload.client_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-gray-400 mr-2" />
                        {upload.filename}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(upload.status)}
                        <span
                          className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            upload.status
                          )}`}
                        >
                          {upload.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="text-sm">
                          {upload.records_successful} /{" "}
                          {upload.records_processed} successful
                        </div>
                        {upload.records_failed > 0 && (
                          <div className="text-xs text-red-600">
                            {upload.records_failed} failed
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(upload.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">CSV Upload Instructions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure your CSV file has the correct column headers</li>
              <li>
                Required columns: ticker, name, sector, quantity, avg_cost,
                trade_date, side, fees
              </li>
              <li>Date format should be YYYY-MM-DD</li>
              <li>Numeric values should not include currency symbols</li>
              <li>Side column should contain either "BUY" or "SELL"</li>
              <li>Maximum file size: 10MB</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
