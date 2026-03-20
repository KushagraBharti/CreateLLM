import { describe, expect, it } from "vitest";
import {
  createBringYourOwnModel,
  getDefaultModels,
  isValidOpenRouterModelId,
  resolveSelectedModels,
} from "@/lib/models";

describe("model catalog", () => {
  it("keeps a default roster", () => {
    expect(getDefaultModels().length).toBeGreaterThanOrEqual(4);
  });

  it("validates OpenRouter ids and creates BYOM entries", () => {
    expect(isValidOpenRouterModelId("openai/gpt-5.4")).toBe(true);
    expect(isValidOpenRouterModelId("bad-model")).toBe(false);
    expect(createBringYourOwnModel("openai/gpt-5.4").openRouterId).toBe("openai/gpt-5.4");
  });

  it("dedupes selected and custom models", () => {
    const models = resolveSelectedModels(["gpt-5.4-mini"], ["openai/gpt-5.4-mini", "custom/provider"]);
    expect(models.length).toBe(2);
  });

  it("preserves duplicate selections as separate slots", () => {
    const models = resolveSelectedModels(
      ["gpt-5.4-mini", "gpt-5.4-mini"],
      ["google/gemini-3.1-flash-lite-preview", "google/gemini-3.1-flash-lite-preview"]
    );
    expect(models).toHaveLength(4);
    expect(models[0]?.openRouterId).toBe("openai/gpt-5.4-mini");
    expect(models[1]?.openRouterId).toBe("openai/gpt-5.4-mini");
    expect(models[0]?.id).not.toBe(models[1]?.id);
    expect(models[2]?.openRouterId).toBe("google/gemini-3.1-flash-lite-preview");
    expect(models[3]?.openRouterId).toBe("google/gemini-3.1-flash-lite-preview");
  });
});
