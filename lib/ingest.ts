import { promises as fs } from "node:fs";
import path from "node:path";

export interface ParsedMarketUrls {
  kalshiTicker: string;
  polymarketSlug: string;
  polymarketEventId: string;
  polymarketTokenIds: {
    yes: string;
    no: string;
  };
  createdAt: string;
}

interface PolymarketOutcome {
  outcome?: string;
  clobTokenId?: string;
  clobTokenIds?: string[];
}

interface PolymarketEventResponse {
  id?: string;
  slug?: string;
  markets?: Array<{
    outcomes?: PolymarketOutcome[];
  }>;
  outcomePrices?: string[];
}

export const POSITIONS_JSON_PATH = path.join(process.cwd(), "positions.json");

function extractKalshiTicker(kalshiUrl: string): string {
  const parsed = new URL(kalshiUrl);
  const match = parsed.pathname.match(/^\/markets\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid Kalshi URL: ${kalshiUrl}`);
  }
  return decodeURIComponent(match[1]);
}

function extractPolymarketSlug(polyUrl: string): string {
  const parsed = new URL(polyUrl);
  const match = parsed.pathname.match(/^\/event\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Invalid Polymarket URL: ${polyUrl}`);
  }
  return decodeURIComponent(match[1]);
}

async function fetchPolymarketEvent(slug: string): Promise<PolymarketEventResponse> {
  const endpoint = `https://gamma-api.polymarket.com/events/slug/${encodeURIComponent(slug)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Polymarket event for slug=${slug}, status=${response.status}`);
  }

  const payload = (await response.json()) as PolymarketEventResponse | PolymarketEventResponse[];
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error(`No Polymarket event found for slug=${slug}`);
    }
    return payload[0];
  }

  return payload;
}

function extractYesNoTokenIds(event: PolymarketEventResponse): { yes: string; no: string } {
  const outcomes = event.markets?.flatMap((market) => market.outcomes ?? []) ?? [];

  let yes: string | undefined;
  let no: string | undefined;

  for (const outcome of outcomes) {
    const normalizedOutcome = (outcome.outcome ?? "").trim().toLowerCase();
    const directId = outcome.clobTokenId ?? outcome.clobTokenIds?.[0];

    if (normalizedOutcome === "yes" && directId) {
      yes = directId;
    }
    if (normalizedOutcome === "no" && directId) {
      no = directId;
    }
  }

  if (!yes || !no) {
    throw new Error(`Could not find YES/NO clobTokenIds on Polymarket event id=${event.id ?? "unknown"}`);
  }

  return { yes, no };
}

async function writePositionJson(entry: ParsedMarketUrls): Promise<void> {
  let existing: ParsedMarketUrls[] = [];

  try {
    const raw = await fs.readFile(POSITIONS_JSON_PATH, "utf8");
    existing = JSON.parse(raw) as ParsedMarketUrls[];
  } catch {
    existing = [];
  }

  const deduped = existing.filter(
    (item) => !(item.kalshiTicker === entry.kalshiTicker && item.polymarketSlug === entry.polymarketSlug),
  );
  deduped.push(entry);

  await fs.writeFile(POSITIONS_JSON_PATH, JSON.stringify(deduped, null, 2), "utf8");
}

async function tryInsertIntoSqlite(entry: ParsedMarketUrls): Promise<boolean> {
  try {
    const sqlite3 = await import("sqlite3");
    const { open } = await import("sqlite");

    const db = await open({
      filename: path.join(process.cwd(), "positions.db"),
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS market_pairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kalshi_ticker TEXT NOT NULL,
        polymarket_slug TEXT NOT NULL,
        polymarket_event_id TEXT NOT NULL,
        poly_yes_token_id TEXT NOT NULL,
        poly_no_token_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(kalshi_ticker, polymarket_slug)
      );
    `);

    await db.run(
      `INSERT OR REPLACE INTO market_pairs
        (kalshi_ticker, polymarket_slug, polymarket_event_id, poly_yes_token_id, poly_no_token_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      entry.kalshiTicker,
      entry.polymarketSlug,
      entry.polymarketEventId,
      entry.polymarketTokenIds.yes,
      entry.polymarketTokenIds.no,
      entry.createdAt,
    );

    await db.close();
    return true;
  } catch {
    return false;
  }
}

export async function parseMarketUrls(kalshiUrl: string, polyUrl: string): Promise<ParsedMarketUrls> {
  const kalshiTicker = extractKalshiTicker(kalshiUrl);
  const polymarketSlug = extractPolymarketSlug(polyUrl);

  const event = await fetchPolymarketEvent(polymarketSlug);
  const polymarketTokenIds = extractYesNoTokenIds(event);

  const pair: ParsedMarketUrls = {
    kalshiTicker,
    polymarketSlug,
    polymarketEventId: event.id ?? "unknown",
    polymarketTokenIds,
    createdAt: new Date().toISOString(),
  };

  const sqliteStored = await tryInsertIntoSqlite(pair);
  if (!sqliteStored) {
    await writePositionJson(pair);
  }

  return pair;
}
