import { NextRequest, NextResponse } from "next/server";
import { executeTrade, listMockPositions, startPositionManager } from "@/lib/executor";
import { getCurrentOrderbooks, getPairById } from "@/lib/mockData";

startPositionManager({ getPairById, getCurrentOrderbooks }, 2_000);

interface ExecutePayload {
  pairId: string;
  requestedSize: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json()) as ExecutePayload;

  if (!payload?.pairId || typeof payload.requestedSize !== "number") {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  const result = await executeTrade(payload.pairId, payload.requestedSize, {
    getPairById,
    getCurrentOrderbooks,
  });

  return NextResponse.json({
    ...result,
    positions: listMockPositions(),
  });
}
