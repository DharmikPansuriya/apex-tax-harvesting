"use client";

import { Layout } from "@/components/Layout";
import { CSVUploadPage } from "@/components/CSVUploadPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function Upload() {
  return (
    <ProtectedRoute>
      <Layout>
        <CSVUploadPage />
      </Layout>
    </ProtectedRoute>
  );
}
