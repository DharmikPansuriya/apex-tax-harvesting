"use client";

import { Layout } from "@/components/Layout";
import { TLHPage } from "@/components/TLHPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function TLH() {
  return (
    <ProtectedRoute>
      <Layout>
        <TLHPage />
      </Layout>
    </ProtectedRoute>
  );
}
