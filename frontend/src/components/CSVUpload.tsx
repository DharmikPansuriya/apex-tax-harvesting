"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface CSVUploadProps {
  clientId: string;
  onSuccess?: () => void;
}

export function CSVUpload({ clientId, onSuccess }: CSVUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log("Upload mutation started for file:", file.name);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client", clientId);

      console.log("Uploading file with FormData:", {
        file: file.name,
        client: clientId,
      });

      try {
        // Use the uploadCSV method which handles FormData properly
        const uploadResponse = await apiClient.uploadCSV(formData);
        console.log("CSV upload response:", uploadResponse);

        return uploadResponse;
      } catch (error) {
        console.error("Error uploading CSV file:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setUploadStatus("completed");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["csv-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      onSuccess?.();
    },
    onError: (error) => {
      setUploadStatus("error");
      console.error("Upload error:", error);

      // Show more specific error message
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Upload failed. Please try again.");
      }
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        alert("Please upload a CSV file");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        alert("Please upload a CSV file");
      }
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      console.log(
        "Starting upload for file:",
        selectedFile.name,
        "for client:",
        clientId
      );

      // Check if user is authenticated
      const token = localStorage.getItem("access_token");
      console.log("Auth token present:", !!token);

      setUploadStatus("uploading");
      setErrorMessage("");
      uploadMutation.mutate(selectedFile);
    } else {
      console.log("No file selected for upload");
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadStatus("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upload Client Holdings CSV
        </h3>
        <p className="text-sm text-gray-600">
          Upload a CSV file containing client holdings data. The file should
          include columns for ticker, name, sector, quantity, avg_cost,
          trade_date, side, and fees.
        </p>
      </div>

      {/* CSV Format Example */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Expected CSV Format:
        </h4>
        <div className="text-xs text-gray-600 font-mono">
          <div>ticker,name,sector,quantity,avg_cost,trade_date,side,fees</div>
          <div>
            AZN.L,AstraZeneca PLC,Pharmaceuticals,100,120.50,2023-01-15,BUY,5.00
          </div>
          <div>SHEL.L,Shell PLC,Oil & Gas,200,25.80,2023-02-20,BUY,10.00</div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <FileText className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={handleUpload}
                disabled={uploadStatus === "uploading"}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
              </button>
              <button
                onClick={resetUpload}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Upload className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Drag and drop your CSV file here
              </p>
              <p className="text-xs text-gray-500">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                browse files
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Status */}
      {uploadStatus && (
        <div className="mt-6 p-4 rounded-lg">
          {uploadStatus === "uploading" && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-sm">
                Uploading and processing CSV file...
              </span>
            </div>
          )}

          {uploadStatus === "completed" && (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-3" />
              <span className="text-sm">
                CSV uploaded successfully! Holdings have been processed and
                added to the portfolio.
              </span>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="flex items-start text-red-600">
              <XCircle className="h-4 w-4 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium mb-1">Upload failed</div>
                {errorMessage && (
                  <div className="text-red-700 mb-2">{errorMessage}</div>
                )}
                <div>
                  Please check your file format and try again. Make sure the CSV
                  has the correct headers.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure your CSV file has the correct column headers</li>
              <li>Date format should be YYYY-MM-DD</li>
              <li>Numeric values should not include currency symbols</li>
              <li>Side should be "BUY" or "SELL"</li>
              <li>Fees should be included (can be 0.00)</li>
              <li>Download the sample CSV to see the exact format</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
