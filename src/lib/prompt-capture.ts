import { promises as fs } from "fs";
import path from "path";
import { ChatMessage, ReasoningConfig } from "./openrouter";

export type PromptCaptureStage = "generate" | "critique" | "revise" | "vote";
export type PromptCaptureAttempt = "initial" | "retry";

export interface PromptCaptureEntry {
  runId: string;
  stage: PromptCaptureStage;
  modelId: string;
  openRouterId: string;
  timestamp: string;
  attempt: PromptCaptureAttempt;
  stream: boolean;
  reasoning?: ReasoningConfig;
  messages: ChatMessage[];
  requestBody: Record<string, unknown>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const PROMPT_CAPTURES_DIR = path.join(DATA_DIR, "prompt-captures");

async function ensurePromptCaptureDir() {
  await fs.mkdir(PROMPT_CAPTURES_DIR, { recursive: true });
}

function promptCapturePath(runId: string): string {
  return path.join(PROMPT_CAPTURES_DIR, `${runId}.jsonl`);
}

export async function appendPromptCapture(entry: PromptCaptureEntry): Promise<void> {
  await ensurePromptCaptureDir();
  await fs.appendFile(promptCapturePath(entry.runId), `${JSON.stringify(entry)}\n`, "utf-8");
}

export async function loadPromptCaptures(runId: string): Promise<PromptCaptureEntry[]> {
  try {
    const content = await fs.readFile(promptCapturePath(runId), "utf-8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PromptCaptureEntry);
  } catch {
    return [];
  }
}
