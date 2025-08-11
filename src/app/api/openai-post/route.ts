import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  apiKey: z.string().optional(),
  style: z.string().min(1),
  hook: z.string().min(1),
  text: z.string().min(1),
  useEmojis: z.boolean().optional(),
  useHashtags: z.boolean().optional(),
  model: z.enum(["gpt-5", "gpt-5-mini", "gpt-5-nano"]).optional().default("gpt-5-mini"),
  reasoningEffort: z.enum(["minimal", "low", "medium", "high"]).optional().default("minimal"),
  verbosity: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { apiKey, style, hook, text, useEmojis, useHashtags, model, reasoningEffort, verbosity } = parsed.data;

  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is required" }, { status: 400 });
  }

  try {
    // First request: Generate the Sorani post using GPT-5 Chat Completions API
    const postPrompt = `Rewrite this Reddit content (post + selected comments) into a high-quality Kurdish Sorani LinkedIn post.

Constraints:
- Output must be Sorani Kurdish only.
- Style: ${style}.
- Hook type: ${hook}. Start with an attention-grabbing hook.
- Keep it professional and concise, with a clear narrative.
- Use right-to-left layout, suitable for LinkedIn.
- ${useEmojis ? "Use emojis for bullets and numbers and tasteful emphasis." : "Avoid using emojis."}
- ${useHashtags ? "Include a short line of relevant Kurdish or English hashtags at the end (2-6)." : "Do not include hashtags."}
- Preserve factual accuracy for quotes/stats.

Content:
${text}`;

    const postResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a Kurdish Sorani social media copywriter. Always respond only in Sorani Kurdish (Central Kurdish)."
          },
          {
            role: "user",
            content: postPrompt
          }
        ],
        reasoning_effort: reasoningEffort,
        verbosity,
        max_completion_tokens: 10000,
      }),
    });

    if (!postResponse.ok) {
      const error = await postResponse.json();
      throw new Error(error.error?.message || "Failed to generate post");
    }

    const postData = await postResponse.json();
    
    // Extract text from Chat Completions response
    const sorani = postData.choices?.[0]?.message?.content || "";

    if (!sorani) {
      console.error("GPT-5 response - finish_reason:", postData.choices?.[0]?.finish_reason);
      console.error("GPT-5 response - reasoning_tokens:", postData.usage?.completion_tokens_details?.reasoning_tokens);
      console.error("GPT-5 response - completion_tokens:", postData.usage?.completion_tokens);
      
      if (postData.choices?.[0]?.finish_reason === "length") {
        throw new Error("GPT-5 response was cut off due to token limit. All tokens were used for reasoning.");
      }
      
      throw new Error("Unable to extract text from GPT-5 response");
    }

    // Second request: Generate image prompt
    const imagePromptInput = `From the following Sorani LinkedIn post, derive one concise English prompt that describes a LinkedIn-suitable illustrative image (no text in image). Prefer a wide aspect (landscape). Return only the prompt.

Post:
${sorani}`;

    const imagePromptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini", // Use mini for simple prompt generation
        messages: [
          {
            role: "system",
            content: "You are an expert at creating concise, concrete visual prompts for image generation. Language: English."
          },
          {
            role: "user",
            content: imagePromptInput
          }
        ],
        reasoning_effort: "minimal",
        verbosity: "low",
        max_completion_tokens: 800,
      }),
    });

    if (!imagePromptResponse.ok) {
      const error = await imagePromptResponse.json();
      throw new Error(error.error?.message || "Failed to generate image prompt");
    }

    const imagePromptData = await imagePromptResponse.json();
    const imagePrompt = imagePromptData.choices?.[0]?.message?.content || "";

    return NextResponse.json({ sorani, imagePrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
