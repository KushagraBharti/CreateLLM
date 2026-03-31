import { NextRequest } from "next/server";
import { getDefaultModels } from "@/lib/models";
import { createBenchmarkRun, fetchConcurrentLimitState } from "@/lib/convex-server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
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
    const run = await createBenchmarkRun({
      categoryId,
      prompt: prompt.trim(),
      selectedModelIds,
      customModelIds,
    });

    return Response.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start benchmark";
    if (message.includes("concurrent run limit")) {
      const details = await fetchConcurrentLimitState().catch(() => null);
      return Response.json(
        {
          error: message,
          code: "CONCURRENT_RUN_LIMIT",
          details,
        },
        { status: 409 }
      );
    }
    const status =
      message === "Not authenticated"
        ? 401
        : message === "Unauthorized"
          ? 403
          : 400;
    return Response.json(
      { error: message },
      { status }
    );
  }
}
