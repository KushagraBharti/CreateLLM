import { NextRequest } from "next/server";
import { createAndQueueRun, ensureSchedulerBootstrapped } from "@/lib/run-scheduler";
import { getDefaultModels } from "@/lib/models";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  await ensureSchedulerBootstrapped();

  const body = await request.json();
  const categoryId = body.categoryId as string | undefined;
  const prompt = body.prompt as string | undefined;
  const selectedModelIds = Array.isArray(body.selectedModelIds)
    ? (body.selectedModelIds as string[])
    : getDefaultModels().map((model) => model.id);
  const customModelIds = Array.isArray(body.customModelIds)
    ? (body.customModelIds as string[])
    : [];

  if (!categoryId || !prompt?.trim()) {
    return Response.json(
      { error: "categoryId and prompt are required" },
      { status: 400 }
    );
  }

  try {
    const run = await createAndQueueRun({
      categoryId,
      prompt: prompt.trim(),
      selectedModelIds,
      customModelIds,
    });

    return Response.json({ id: run.id, status: run.status });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to start benchmark" },
      { status: 400 }
    );
  }
}
