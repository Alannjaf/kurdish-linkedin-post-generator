import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export function getAnthropicClient(apiKey?: string) {
  const key = apiKey ?? env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Anthropic API key not provided");
  }
  return new Anthropic({ apiKey: key });
}

export const DEFAULT_SONNET_MODEL = "claude-3-5-sonnet-20240620";
