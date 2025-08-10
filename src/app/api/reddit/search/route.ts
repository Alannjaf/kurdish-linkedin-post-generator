import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { z } from "zod";
import { searchReddit } from "@/lib/reddit";

const schema = z.object({
  q: z.string().min(1),
  sort: z.enum(["hot", "new", "top", "relevance"]).optional(),
  t: z.enum(["hour", "day", "week", "month", "year", "all"]).optional(),
  titleOnly: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const sort =
    (searchParams.get("sort") as "hot" | "new" | "top" | "relevance") ||
    "relevance";
  const t =
    (searchParams.get("t") as
      | "hour"
      | "day"
      | "week"
      | "month"
      | "year"
      | "all") || "day";
  const titleOnly = (searchParams.get("titleOnly") ?? "true") as
    | "true"
    | "false";
  const parsed = schema.safeParse({ q, sort, t, titleOnly });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  try {
    const tVal = parsed.data.t ?? "day";

    const baseQuery = parsed.data.q.trim();
    const onlyTitle = parsed.data.titleOnly === "true";
    const opQuery = onlyTitle ? `title:${baseQuery}` : baseQuery;

    const runSearch = async (
      timeWindow: "hour" | "day" | "week" | "month" | "year" | "all",
      whichSort: "hot" | "new" | "top" | "relevance"
    ) => {
      const list = await searchReddit(opQuery, 50, whichSort, timeWindow);
      const tokens = parsed.data.q
        .toLowerCase()
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);
      if (!tokens.length) return list;

      type P = { title?: string; selftext?: string };
      const titleOf = (p: P) => (p.title || "").toLowerCase();
      const bodyOf = (p: P) => (p.selftext || "").toLowerCase();
      const haystack = (p: P) =>
        onlyTitle ? titleOf(p) : `${titleOf(p)} ${bodyOf(p)}`;

      // Try strict (all tokens), then relaxed (any token)
      const all = list.filter((p: P) =>
        tokens.every((tkn) => haystack(p).includes(tkn))
      );
      if (all.length) return all;
      const any = list.filter((p: P) =>
        tokens.some((tkn) => haystack(p).includes(tkn))
      );
      return any.length ? any : list;
    };

    // Attempt with requested t, then progressively relax timeframe if needed
    // Prefer relevance first
    let filtered = await runSearch(tVal, "relevance");
    if (!filtered.length) {
      filtered = await runSearch(tVal, "top");
    }
    if (!filtered.length) {
      for (const nextT of ["week", "month", "year", "all"] as const) {
        if (nextT === tVal) continue;
        filtered = await runSearch(nextT, "relevance");
        if (filtered.length) break;
        filtered = await runSearch(nextT, "top");
        if (filtered.length) break;
      }
    }

    return NextResponse.json({ posts: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
