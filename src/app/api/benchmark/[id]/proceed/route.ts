import { NextRequest } from "next/server";
import { proceedBenchmarkRun } from "@/lib/run-scheduler";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await proceedBenchmarkRun(id);
  return Response.json(run);
}
