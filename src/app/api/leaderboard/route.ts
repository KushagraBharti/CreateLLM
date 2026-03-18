import { NextResponse } from "next/server";
import { getLeaderboardData } from "@/lib/results";

export async function GET() {
  try {
    const data = await getLeaderboardData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      global: [],
      byCategory: {},
      totals: { runs: 0, ideas: 0, critiques: 0, completedModels: 0 },
    });
  }
}
