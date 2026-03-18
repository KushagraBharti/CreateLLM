import { describe, expect, it } from "vitest";
import { inCompletionOrder } from "@/lib/async";

describe("inCompletionOrder", () => {
  it("yields results in completion order instead of submission order", async () => {
    const tasks = [
      new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 20)),
      new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 5)),
      new Promise<string>((resolve) => setTimeout(() => resolve("mid"), 10)),
    ];

    const seen: string[] = [];
    for await (const result of inCompletionOrder(tasks)) {
      if (result.value) seen.push(result.value);
    }

    expect(seen).toEqual(["fast", "mid", "slow"]);
  });
});
