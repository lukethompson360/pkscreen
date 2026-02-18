"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

interface DashboardPair {
  id: string;
  marketName: string;
  kalshiAsk: number;
  polyAsk: number;
  netRoi: number;
  maxSize: number;
}

interface PairsApiResponse {
  pairs: DashboardPair[];
}

interface ExecuteApiResponse {
  ok: boolean;
  message: string;
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

async function executeFok(pairId: string, requestedSize: number): Promise<ExecuteApiResponse> {
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairId, requestedSize }),
  });

  if (!response.ok) {
    throw new Error(`Execute API failed: ${response.status}`);
  }

  return (await response.json()) as ExecuteApiResponse;
}

export default function DashboardPage(): JSX.Element {
  const { data, error, isLoading, mutate } = useSWR<PairsApiResponse>("/api/pairs", fetcher, {
    refreshInterval: 2_000,
    revalidateOnFocus: true,
  });

  const [pendingPairId, setPendingPairId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const pairs = useMemo(() => data?.pairs ?? [], [data?.pairs]);

  const onExecute = async (pair: DashboardPair): Promise<void> => {
    setPendingPairId(pair.id);
    setStatusMessage("");

    try {
      const result = await executeFok(pair.id, pair.maxSize);
      setStatusMessage(result.message);
      await mutate();
    } catch (executeError) {
      const message = executeError instanceof Error ? executeError.message : "Unknown execution error";
      setStatusMessage(message);
    } finally {
      setPendingPairId(null);
    }
  };

  if (isLoading) {
    return <main className="p-6 text-sm">Loading market pairs...</main>;
  }

  if (error) {
    return <main className="p-6 text-sm text-red-600">Failed to load dashboard data.</main>;
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">pkarb OMS Dashboard</h1>
      {statusMessage ? <p className="text-sm text-blue-700">{statusMessage}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2">Market Name</th>
              <th className="px-4 py-2">Kalshi Ask</th>
              <th className="px-4 py-2">Poly Ask</th>
              <th className="px-4 py-2">Net ROI %</th>
              <th className="px-4 py-2">Max Size ($)</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair) => (
              <tr key={pair.id} className="border-t border-gray-200">
                <td className="px-4 py-2">{pair.marketName}</td>
                <td className="px-4 py-2">{pair.kalshiAsk.toFixed(4)}</td>
                <td className="px-4 py-2">{pair.polyAsk.toFixed(4)}</td>
                <td className={`px-4 py-2 ${pair.netRoi >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {(pair.netRoi * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-2">{pair.maxSize.toFixed(2)}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onExecute(pair)}
                    disabled={pendingPairId === pair.id}
                    className="rounded bg-black px-3 py-1 text-white disabled:opacity-60"
                  >
                    {pendingPairId === pair.id ? "Executing..." : "Execute FOK"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
