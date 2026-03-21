import { ReasoningConfig } from "./openrouter";
export { MODEL_TIMEOUT_MS } from "./runtime-config";

export const REASONING_GENERATE: ReasoningConfig = { effort: "high", exclude: false };
export const REASONING_CRITIQUE: ReasoningConfig = { effort: "medium", exclude: false };
export const REASONING_REVISE: ReasoningConfig = { effort: "high", exclude: false };
export const REASONING_VOTE: ReasoningConfig = { effort: "medium", exclude: false };
export const JSON_RETRY_MESSAGE =
  "Your response was not valid JSON. Please respond with ONLY valid JSON in the exact format specified above. No markdown, no explanation; only the JSON object.";
