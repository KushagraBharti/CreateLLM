import { NextRequest } from "next/server";
import { cancelBenchmarkRunServer } from "@/lib/convex-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const run = await cancelBenchmarkRunServer(id, typeof body.reason === "string" ? body.reason : undefined);
  return Response.json(run);
}
