import { calculateArbitrage, type Orderbook } from "./arbMath";

export interface TradePair {
  id: string;
  marketName: string;
  kalshiOrderbook: Orderbook;
  polymarketOrderbook: Orderbook;
}

export interface MockPosition {
  id: string;
  pairId: string;
  entryCost: number;
  size: number;
  openedAt: string;
  status: "OPEN" | "CLOSED";
  closedAt?: string;
  closeReason?: "TAKE_PROFIT" | "STOP_LOSS";
  pnlPercent?: number;
}

export interface ExecutionResult {
  ok: boolean;
  message: string;
  position?: MockPosition;
}

export interface ExecutionDependencies {
  getPairById: (pairId: string) => Promise<TradePair | null>;
  getCurrentOrderbooks: (pairId: string) => Promise<Pick<TradePair, "kalshiOrderbook" | "polymarketOrderbook"> | null>;
}

const TAKE_PROFIT_THRESHOLD = 0.05;
const STOP_LOSS_THRESHOLD = -0.02;

const mockPositions: MockPosition[] = [];
let monitorIntervalHandle: NodeJS.Timeout | null = null;

export async function executeTrade(
  pairId: string,
  requestedSize: number,
  deps: ExecutionDependencies,
): Promise<ExecutionResult> {
  if (requestedSize <= 0 || !Number.isFinite(requestedSize)) {
    return { ok: false, message: "Trade Failed: Invalid requested size" };
  }

  const pair = await deps.getPairById(pairId);
  if (!pair) {
    return { ok: false, message: `Trade Failed: Unknown pairId=${pairId}` };
  }

  const arb = calculateArbitrage(pair.kalshiOrderbook, pair.polymarketOrderbook);

  if (requestedSize > arb.maxSize) {
    return {
      ok: false,
      message: `Trade Failed: Slippage (requested=${requestedSize.toFixed(2)}, max=${arb.maxSize.toFixed(2)})`,
    };
  }

  const position: MockPosition = {
    id: crypto.randomUUID(),
    pairId,
    entryCost: arb.grossCost,
    size: requestedSize,
    openedAt: new Date().toISOString(),
    status: "OPEN",
  };

  mockPositions.push(position);

  return {
    ok: true,
    message: `Fill: pair=${pairId} size=${requestedSize.toFixed(2)} cost=${arb.grossCost.toFixed(4)}`,
    position,
  };
}

export function listMockPositions(): MockPosition[] {
  return mockPositions.map((position) => ({ ...position }));
}

export function startPositionManager(deps: ExecutionDependencies, intervalMs = 1_000): void {
  if (monitorIntervalHandle) {
    return;
  }

  monitorIntervalHandle = setInterval(async () => {
    const openPositions = mockPositions.filter((position) => position.status === "OPEN");

    for (const position of openPositions) {
      const snapshot = await deps.getCurrentOrderbooks(position.pairId);
      if (!snapshot) {
        continue;
      }

      const kalshiBestBid = [...snapshot.kalshiOrderbook.bids].sort((a, b) => b.price - a.price)[0];
      const polyBestBid = [...snapshot.polymarketOrderbook.bids].sort((a, b) => b.price - a.price)[0];

      if (!kalshiBestBid || !polyBestBid) {
        continue;
      }

      const currentValue = kalshiBestBid.price + polyBestBid.price;
      const pnlPercent = (currentValue - position.entryCost) / position.entryCost;

      if (pnlPercent >= TAKE_PROFIT_THRESHOLD) {
        closePosition(position, "TAKE_PROFIT", pnlPercent);
      } else if (pnlPercent <= STOP_LOSS_THRESHOLD) {
        closePosition(position, "STOP_LOSS", pnlPercent);
      }
    }
  }, intervalMs);
}

export function stopPositionManager(): void {
  if (monitorIntervalHandle) {
    clearInterval(monitorIntervalHandle);
    monitorIntervalHandle = null;
  }
}

function closePosition(
  position: MockPosition,
  reason: "TAKE_PROFIT" | "STOP_LOSS",
  pnlPercent: number,
): void {
  position.status = "CLOSED";
  position.closedAt = new Date().toISOString();
  position.closeReason = reason;
  position.pnlPercent = pnlPercent;
}
