import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient, DEFAULT_IMAGE_MODEL } from "@/lib/openai";

// Use sizes supported by gpt-image-1 and good for LinkedIn (landscape)
const schema = z.object({
  apiKey: z.string().optional(),
  prompt: z.string().min(1),
  size: z
    .enum(["1024x1024", "1024x1536", "1536x1024"]) // LinkedIn favors 1200x627, approximated by 1536x1024
    .default("1536x1024")
    .optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { apiKey, prompt } = parsed.data;
  const size = parsed.data.size ?? "1024x1024";

  try {
    const openai = getOpenAIClient(apiKey);
    const result = await openai.images.generate({
      model: DEFAULT_IMAGE_MODEL,
      prompt,
      size,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64)
      return NextResponse.json({ error: "No image returned" }, { status: 500 });
    return NextResponse.json({ b64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
