import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient, DEFAULT_SONNET_MODEL } from "@/lib/anthropic";

const schema = z.object({
  apiKey: z.string().optional(),
  style: z.string().min(1),
  hook: z.string().min(1),
  text: z.string().min(1),
  useEmojis: z.boolean().optional(),
  useHashtags: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { apiKey, style, hook, text, useEmojis, useHashtags } = parsed.data;

  try {
    const anthropic = getAnthropicClient(apiKey);
    const response = await anthropic.messages.create({
      model: DEFAULT_SONNET_MODEL,
      max_tokens: 1400,
      system:
        "You are a Kurdish Sorani social media copywriter. Always respond only in Sorani Kurdish (Central Kurdish).",
      messages: [
        {
          role: "user",
          content: `Rewrite this Reddit content (post + selected comments) into a high-quality Kurdish Sorani LinkedIn post.\n\nConstraints:\n- Output must be Sorani Kurdish only.\n- Style: ${style}.\n- Hook type: ${hook}. Start with an attention-grabbing hook.\n- Keep it professional and concise, with a clear narrative.\n- Use right-to-left layout, suitable for LinkedIn.\n- ${
            useEmojis
              ? "Use emojis for bullets and numbers and tasteful emphasis."
              : "Avoid using emojis."
          }\n- ${
            useHashtags
              ? "Include a short line of relevant Kurdish or English hashtags at the end (2-6)."
              : "Do not include hashtags."
          }\n- Preserve factual accuracy for quotes/stats.\n\nContent:\n${text}`,
        },
      ],
    });

    const content = response.content?.[0];
    const sorani = content && content.type === "text" ? content.text : "";

    // Also produce an image prompt
    const imagePromptResp = await anthropic.messages.create({
      model: DEFAULT_SONNET_MODEL,
      max_tokens: 400,
      system:
        "You are an expert at creating concise, concrete visual prompts for image generation. Language: English.",
      messages: [
        {
          role: "user",
          content:
            "From the following Sorani LinkedIn post, derive one concise English prompt that describes a LinkedIn-suitable illustrative image (no text in image). Prefer a wide aspect (landscape). Return only the prompt. Post:\n" +
            sorani,
        },
      ],
    });
    const imgContent = imagePromptResp.content?.[0];
    const imagePrompt =
      imgContent && imgContent.type === "text" ? imgContent.text : "";

    return NextResponse.json({ sorani, imagePrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
