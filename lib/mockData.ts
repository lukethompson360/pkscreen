import { calculateArbitrage, type Orderbook } from "./arbMath";
import type { TradePair } from "./executor";

interface DashboardPairRow {
  id: string;
  marketName: string;
  kalshiAsk: number;
  polyAsk: number;
  netRoi: number;
  maxSize: number;
}

const pairs: TradePair[] = [
  {
    id: "1",
    marketName: "US CPI YoY Above 3% (Next Release)",
    kalshiOrderbook: {
      asks: [{ price: 0.47, size: 500 }],
      bids: [{ price: 0.46, size: 600 }],
    },
    polymarketOrderbook: {
      asks: [{ price: 0.45, size: 420 }],
      bids: [{ price: 0.44, size: 450 }],
    },
  },
  {
    id: "2",
    marketName: "Fed Cut by Next Meeting",
    kalshiOrderbook: {
      asks: [{ price: 0.40, size: 300 }],
      bids: [{ price: 0.39, size: 280 }],
    },
    polymarketOrderbook: {
      asks: [{ price: 0.53, size: 260 }],
      bids: [{ price: 0.52, size: 260 }],
    },
  },
];

export async function getPairs(): Promise<TradePair[]> {
  return pairs;
}

export async function getPairById(pairId: string): Promise<TradePair | null> {
  return pairs.find((pair) => pair.id === pairId) ?? null;
}

export async function getCurrentOrderbooks(
  pairId: string,
): Promise<{ kalshiOrderbook: Orderbook; polymarketOrderbook: Orderbook } | null> {
  const pair = pairs.find((row) => row.id === pairId);
  if (!pair) {
    return null;
  }

  return {
    kalshiOrderbook: pair.kalshiOrderbook,
    polymarketOrderbook: pair.polymarketOrderbook,
  };
}

export async function getDashboardRows(): Promise<DashboardPairRow[]> {
  const sourcePairs = await getPairs();

  return sourcePairs.map((pair) => {
    const arb = calculateArbitrage(pair.kalshiOrderbook, pair.polymarketOrderbook);
    return {
      id: pair.id,
      marketName: pair.marketName,
      kalshiAsk: arb.kalshiBestAsk,
      polyAsk: arb.polymarketBestAsk,
      netRoi: arb.netRoi,
      maxSize: arb.maxSize,
    };
  });
}
