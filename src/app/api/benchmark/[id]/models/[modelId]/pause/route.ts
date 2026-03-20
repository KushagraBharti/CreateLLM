import { NextRequest } from "next/server";
import { pauseModelInRun } from "@/lib/run-scheduler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  const { id, modelId } = await params;
  const body = await request.json().catch(() => ({}));
  const run = await pauseModelInRun(id, modelId, typeof body.reason === "string" ? body.reason : undefined);
  return Response.json(run);
}
