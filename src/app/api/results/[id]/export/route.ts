import { NextRequest } from "next/server";
import { listRunExportsServer, requestRunExportServer } from "@/lib/convex-server";

function resolveFormat(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  return format === "csv" ? "csv" : "json";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const exports = await listRunExportsServer(id);
  const format = resolveFormat(request);
  return Response.json(exports.filter((entry) => entry.format === format));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const format = body?.format === "csv" ? "csv" : "json";
  const exportEntry = await requestRunExportServer(id, format);
  return Response.json(exportEntry);
}
