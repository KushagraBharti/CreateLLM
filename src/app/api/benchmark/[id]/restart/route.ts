import { NextRequest } from "next/server";
import { restartBenchmarkRunServer } from "@/lib/convex-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await restartBenchmarkRunServer(id);
  return Response.json(run);
}
