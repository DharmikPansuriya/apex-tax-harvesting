"use client";

import { useState } from "react";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { useTransactions } from "@/hooks/useApi";
import { formatCurrency } from "@/utils/format";

export function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<
    | "trade_date"
    | "holding_ticker"
    | "side"
    | "qty"
    | "price"
    | "fees"
    | "notional"
    | "pl"
  >("trade_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { data, isLoading, error } = useTransactions();
  const txs = data?.results || [];

  const filtered = txs.filter((t: any) =>
    `${t.holding_ticker} ${t.holding_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const getNumeric = (t: any, key: string) => {
    if (key === "notional")
      return Number(t.notional ?? t.total_value ?? t.qty * t.price);
    if (key === "pl") return t.side === "SELL" ? Number(t.pl ?? 0) : 0;
    return Number(t[key] ?? 0);
  };

  const getComparable = (t: any, key: typeof sortKey) => {
    if (key === "trade_date") return new Date(t.trade_date).getTime();
    if (key === "holding_ticker" || key === "side")
      return String(t[key] ?? "").toLowerCase();
    return getNumeric(t, key);
  };

  const sorted = [...filtered].sort((a: any, b: any) => {
    const av = getComparable(a, sortKey);
    const bv = getComparable(b, sortKey);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const onSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "trade_date" ? "desc" : "asc");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-600 mt-2">
          All buys and sells with totals and P/L
        </p>
      </div>

      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ticker or name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
        />
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="text-center py-12">Loading transactions…</div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            Failed to load transactions
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("trade_date")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Date
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "trade_date"
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      />
                      {sortKey === "trade_date" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("holding_ticker")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Ticker
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "holding_ticker"
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      />
                      {sortKey === "holding_ticker" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("side")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Side
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "side" ? "text-gray-900" : "text-gray-400"
                        }`}
                      />
                      {sortKey === "side" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("qty")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Qty
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "qty" ? "text-gray-900" : "text-gray-400"
                        }`}
                      />
                      {sortKey === "qty" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("price")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Price
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "price"
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      />
                      {sortKey === "price" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("fees")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Fees
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "fees" ? "text-gray-900" : "text-gray-400"
                        }`}
                      />
                      {sortKey === "fees" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("notional")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      Notional
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "notional"
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      />
                      {sortKey === "notional" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => onSort("pl")}
                  >
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      P/L
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortKey === "pl" ? "text-gray-900" : "text-gray-400"
                        }`}
                      />
                      {sortKey === "pl" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-gray-900" />
                        ))}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((t: any) => {
                  const notional = Number(
                    t.notional ?? t.total_value ?? t.qty * t.price
                  );
                  const pl = t.side === "SELL" ? Number(t.pl ?? 0) : 0;
                  const isProfit = pl >= 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {t.trade_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {t.holding_ticker}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          t.side === "BUY" ? "text-blue-600" : "text-red-600"
                        }`}
                      >
                        {t.side}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {Number(t.qty).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(Number(t.price))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(Number(t.fees ?? 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(notional)}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                          isProfit ? "text-green-600" : "text-red-600"
                        } font-medium`}
                      >
                        {t.side === "SELL" ? formatCurrency(pl) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
