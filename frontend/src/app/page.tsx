"use client";

import { Layout } from "@/components/Layout";
import { GenericDashboard } from "@/components/GenericDashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <Layout>
        <GenericDashboard />
      </Layout>
    </ProtectedRoute>
  );
}
