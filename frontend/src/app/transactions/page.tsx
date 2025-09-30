"use client";

import { Layout } from "@/components/Layout";
import { TransactionsPage } from "@/components/TransactionsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function Transactions() {
  return (
    <ProtectedRoute>
      <Layout>
        <TransactionsPage />
      </Layout>
    </ProtectedRoute>
  );
}
