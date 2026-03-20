import { NextRequest } from "next/server";
import { cancelModelInRun } from "@/lib/run-scheduler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  const { id, modelId } = await params;
  const body = await request.json().catch(() => ({}));
  const run = await cancelModelInRun(id, modelId, typeof body.reason === "string" ? body.reason : undefined);
  return Response.json(run);
}
