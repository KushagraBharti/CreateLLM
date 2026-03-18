import { NextRequest } from "next/server";
import { retryBenchmarkRun } from "@/lib/run-scheduler";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await retryBenchmarkRun(id);
  return Response.json(run);
}
