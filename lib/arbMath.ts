export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
}

export interface ArbCalculationResult {
  kalshiBestAsk: number;
  polymarketBestAsk: number;
  spread: number;
  grossCost: number;
  maxSize: number;
  netRoi: number;
}

const FLAT_FEE = 0.03;

function validateOrderbook(orderbook: Orderbook, source: string): void {
  if (!orderbook.asks.length) {
    throw new Error(`${source} orderbook has no asks`);
  }

  const firstAsk = orderbook.asks[0];
  if (!Number.isFinite(firstAsk.price) || !Number.isFinite(firstAsk.size)) {
    throw new Error(`${source} best ask contains invalid price/size`);
  }
}

function bestAsk(orderbook: Orderbook): OrderbookLevel {
  return [...orderbook.asks].sort((a, b) => a.price - b.price)[0];
}

export function calculateArbitrage(
  kalshiOrderbook: Orderbook,
  polymarketOrderbook: Orderbook,
): ArbCalculationResult {
  validateOrderbook(kalshiOrderbook, "Kalshi");
  validateOrderbook(polymarketOrderbook, "Polymarket");

  const kalshiBestAsk = bestAsk(kalshiOrderbook);
  const polymarketBestAsk = bestAsk(polymarketOrderbook);

  const spread = 1 - (kalshiBestAsk.price + polymarketBestAsk.price);
  const grossCost = kalshiBestAsk.price + polymarketBestAsk.price;
  const maxSize = Math.min(kalshiBestAsk.size, polymarketBestAsk.size);
  const netRoi = (spread - FLAT_FEE) / grossCost;

  return {
    kalshiBestAsk: kalshiBestAsk.price,
    polymarketBestAsk: polymarketBestAsk.price,
    spread,
    grossCost,
    maxSize,
    netRoi,
  };
}
