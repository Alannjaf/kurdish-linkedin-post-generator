import OpenAI from "openai";
import { env } from "./env";

export function getOpenAIClient(apiKey?: string) {
  const key = apiKey ?? env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key not provided");
  }
  return new OpenAI({ apiKey: key });
}

export const DEFAULT_IMAGE_MODEL = "gpt-image-1";
