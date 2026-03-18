import { NextRequest } from "next/server";
import { addHumanCritiquesToRun } from "@/lib/run-scheduler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const critiques = Array.isArray(body.critiques) ? body.critiques : [];

  const run = await addHumanCritiquesToRun(
    id,
    critiques.map((critique: Record<string, unknown>) => ({
      ideaLabel: String(critique.ideaLabel ?? "H"),
      targetModelId: String(critique.targetModelId ?? ""),
      strengths: String(critique.strengths ?? ""),
      weaknesses: String(critique.weaknesses ?? ""),
      suggestions: String(critique.suggestions ?? ""),
      score: Number(critique.score ?? 7),
      authorLabel: String(critique.authorLabel ?? "You"),
    }))
  );

  return Response.json(run);
}
