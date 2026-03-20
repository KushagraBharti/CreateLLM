import { NextRequest } from "next/server";
import { pauseBenchmarkRun } from "@/lib/run-scheduler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const run = await pauseBenchmarkRun(id, typeof body.reason === "string" ? body.reason : undefined);
  return Response.json(run);
}
