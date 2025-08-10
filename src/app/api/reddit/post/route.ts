import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchPostWithComments } from "@/lib/reddit";

const schema = z.object({ permalink: z.string().min(1) });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const permalink = searchParams.get("permalink") ?? "";
  const parsed = schema.safeParse({ permalink });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid permalink" }, { status: 400 });
  }
  try {
    const data = await fetchPostWithComments(parsed.data.permalink);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed" },
      { status: 500 }
    );
  }
}
