import { NextRequest } from "next/server";
import { resumeModelInRun } from "@/lib/run-scheduler";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  const { id, modelId } = await params;
  const run = await resumeModelInRun(id, modelId);
  return Response.json(run);
}
