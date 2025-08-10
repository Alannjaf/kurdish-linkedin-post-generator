import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { z } from "zod";
import { fetchPostWithComments } from "@/lib/reddit";

const schema = z.object({
  permalink: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const permalink = searchParams.get("permalink") ?? "";
  const parsed = schema.safeParse({ permalink });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid permalink" }, { status: 400 });
  }
  try {
    const { post, comments } = await fetchPostWithComments(
      parsed.data.permalink
    );
    return NextResponse.json({ post, comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
