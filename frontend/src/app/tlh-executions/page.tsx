"use client";

import { Layout } from "@/components/Layout";
import { TLHExecutionsPage } from "@/components/TLHExecutionsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function TLHExecutions() {
  return (
    <ProtectedRoute>
      <Layout>
        <TLHExecutionsPage />
      </Layout>
    </ProtectedRoute>
  );
}
