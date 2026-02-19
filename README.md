# pkarb OMS (Next.js)

A lightweight Order Management System dashboard for manual prediction market arbitrage between Kalshi and Polymarket.

## What is implemented

- URL ingestion + parsing (`lib/ingest.ts`)
  - Kalshi ticker extraction from `https://kalshi.com/markets/{ticker}`.
  - Polymarket slug extraction from `https://polymarket.com/event/{slug}`.
  - Polymarket Gamma lookup to fetch YES/NO `clobTokenIds`.
  - Persistence to SQLite (`positions.db`) with fallback JSON (`positions.json`).
- Arbitrage math engine (`lib/arbMath.ts`)
  - Spread, max size, and fee-adjusted ROI calculations.
- Mock execution engine (`lib/executor.ts`)
  - Fill-or-Kill (FOK) size check.
  - TP (+5%) / SL (-2%) position manager.
- Dashboard (`app/page.tsx`)
  - Auto-refreshing table every 2 seconds via SWR.
  - Execute FOK button wired to API route.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Run in GitHub Codespaces

This repo includes `.devcontainer/devcontainer.json` configured to:

- Use a Node 22 dev container image
- Automatically run `npm install` on container creation
- Forward port `3000` and open a preview automatically

After Codespace starts:

```bash
npm run dev
```

Open the forwarded port 3000 preview.

## API endpoints used by the dashboard

- `GET /api/pairs` – Returns active pair rows for the table.
- `POST /api/execute` – Executes a mock FOK trade.

Payload:

```json
{
  "pairId": "1",
  "requestedSize": 100
}
```

## Notes

- Current market data in API routes is mocked in `lib/mockData.ts` so the app runs immediately.
- You can replace `lib/mockData.ts` with real Kalshi/Polymarket connectors while keeping the math/execution interfaces unchanged.
