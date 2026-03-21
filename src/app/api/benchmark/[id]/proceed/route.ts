import { NextRequest } from "next/server";
import { proceedBenchmarkRunServer } from "@/lib/convex-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await proceedBenchmarkRunServer(id);
  return Response.json(run);
}
