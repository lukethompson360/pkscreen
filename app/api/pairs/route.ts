import { NextResponse } from "next/server";
import { getDashboardRows } from "@/lib/mockData";

export async function GET(): Promise<NextResponse> {
  const pairs = await getDashboardRows();
  return NextResponse.json({ pairs });
}
