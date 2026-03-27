import { NextRequest } from "next/server";
import { deleteBenchmarkRunServer } from "@/lib/convex-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await deleteBenchmarkRunServer(id);
  return Response.json(result);
}
