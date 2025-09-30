"use client";

import { Layout } from "@/components/Layout";
import { HoldingsPage } from "@/components/HoldingsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function Holdings() {
  return (
    <ProtectedRoute>
      <Layout>
        <HoldingsPage />
      </Layout>
    </ProtectedRoute>
  );
}
