import { NextRequest } from "next/server";
import { restartBenchmarkRun } from "@/lib/run-scheduler";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await restartBenchmarkRun(id);
  return Response.json(run);
}
