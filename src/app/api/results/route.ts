import { listBenchmarkRunSummaries } from "@/lib/storage";

export async function GET() {
  const summaries = await listBenchmarkRunSummaries();
  return Response.json(summaries);
}
