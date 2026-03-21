import { NextRequest } from "next/server";
import { resumeBenchmarkRunServer } from "@/lib/convex-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await resumeBenchmarkRunServer(id);
  return Response.json(run);
}
