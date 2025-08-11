"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import type { RedditComment } from "@/lib/reddit";

type Post = {
  id: string;
  title: string;
  selftext?: string;
  permalink: string;
  num_comments: number;
  subreddit: string;
  created_utc: number;
};

export default function Home() {
  const [query, setQuery] = useState("AI marketing");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [timeframe, setTimeframe] = useState<
    "hour" | "day" | "week" | "month" | "year" | "all"
  >("day");

  const [selectedPermalink, setSelectedPermalink] = useState<string | null>(
    null
  );
  const [selectedText, setSelectedText] = useState<string>("");
  const [loadingPost, setLoadingPost] = useState(false);

  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHashtags, setUseHashtags] = useState(false);

  const [style, setStyle] = useState("Professional, concise, LinkedIn-ready");
  const [hook, setHook] = useState("Question hook");

  const [sorani, setSorani] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageB64, setImageB64] = useState("");
  const [loadingClaude, setLoadingClaude] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "image">("preview");
  const [order, setOrder] = useState<"upvotes" | "comments" | "none">(
    "upvotes"
  );

  // Model selection state
  const [modelProvider, setModelProvider] = useState<"claude" | "gpt5">(
    "claude"
  );
  const [gpt5Model, setGpt5Model] = useState<
    "gpt-5" | "gpt-5-mini" | "gpt-5-nano"
  >("gpt-5-mini");
  const [reasoningEffort, setReasoningEffort] = useState<
    "minimal" | "low" | "medium" | "high"
  >("minimal");
  const [verbosity, setVerbosity] = useState<"low" | "medium" | "high">(
    "medium"
  );

  //

  // Narrowing helpers for localStorage values and select handlers
  function isGpt5Model(
    value: string
  ): value is "gpt-5" | "gpt-5-mini" | "gpt-5-nano" {
    return (
      value === "gpt-5" || value === "gpt-5-mini" || value === "gpt-5-nano"
    );
  }

  function isReasoningEffort(
    value: string
  ): value is "minimal" | "low" | "medium" | "high" {
    return (
      value === "minimal" ||
      value === "low" ||
      value === "medium" ||
      value === "high"
    );
  }

  function isVerbosity(value: string): value is "low" | "medium" | "high" {
    return value === "low" || value === "medium" || value === "high";
  }

  function formatRelativeTime(createdUtcSeconds: number): string {
    if (!createdUtcSeconds) return "";
    const nowMs = Date.now();
    const createdMs = createdUtcSeconds * 1000;
    const diffSeconds = Math.max(1, Math.floor((nowMs - createdMs) / 1000));
    const minutes = Math.floor(diffSeconds / 60);
    const hours = Math.floor(diffSeconds / 3600);
    const days = Math.floor(diffSeconds / 86400);
    const weeks = Math.floor(diffSeconds / (86400 * 7));
    const months = Math.floor(diffSeconds / (86400 * 30));
    const years = Math.floor(diffSeconds / (86400 * 365));

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 5) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
  }

  async function doSearch() {
    setLoadingSearch(true);
    setPosts(null);
    try {
      const res = await fetch(
        `/api/reddit/search?q=${encodeURIComponent(
          query
        )}&sort=trending&t=${timeframe}&titleOnly=true${
          order !== "none" ? `&order=${order}` : ""
        }`
      );
      const json = await res.json();
      setPosts(json.posts ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function pickPost(permalink: string) {
    setSelectedPermalink(permalink);
    setLoadingPost(true);
    setSorani("");
    setImagePrompt("");
    setImageB64("");
    try {
      const res = await fetch(
        `/api/reddit/post?permalink=${encodeURIComponent(permalink)}`
      );
      const json = (await res.json()) as {
        post?: { title: string; selftext?: string };
        comments?: RedditComment[];
        error?: string;
      };
      if (!res.ok || json.error || !json.post) {
        throw new Error(json.error || "Failed to load post");
      }
      const comments = json.comments ?? [];
      const text =
        `${json.post.title}\n\n${json.post.selftext ?? ""}\n\nTop comments:\n` +
        comments
          .slice(0, 10)
          .map((c) => `- ${c.author}: ${c.body}`)
          .join("\n");
      setSelectedText(text);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPost(false);
    }
  }

  async function runClaude() {
    setLoadingClaude(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: anthropicKey || undefined,
          style,
          hook,
          text: selectedText,
          useEmojis,
          useHashtags,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSorani(json.sorani);
      setImagePrompt(json.imagePrompt);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClaude(false);
    }
  }

  async function runGPT5() {
    setLoadingClaude(true);
    try {
      const res = await fetch("/api/openai-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: openaiKey || undefined,
          style,
          hook,
          text: selectedText,
          useEmojis,
          useHashtags,
          model: gpt5Model,
          reasoningEffort,
          verbosity,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSorani(json.sorani);
      setImagePrompt(json.imagePrompt);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClaude(false);
    }
  }

  async function runImage() {
    setLoadingImage(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: openaiKey || undefined,
          prompt: imagePrompt,
          size: "1536x1024",
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setImageB64(json.b64);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingImage(false);
    }
  }

  useEffect(() => {
    // Load saved keys and preferences
    try {
      const a = localStorage.getItem("anthropic_key");
      const o = localStorage.getItem("openai_key");
      const ue = localStorage.getItem("use_emojis");
      const uh = localStorage.getItem("use_hashtags");
      const mp = localStorage.getItem("model_provider");
      const gm = localStorage.getItem("gpt5_model");
      const re = localStorage.getItem("reasoning_effort");
      const v = localStorage.getItem("verbosity");
      if (a) setAnthropicKey(a);
      if (o) setOpenaiKey(o);
      if (ue != null) setUseEmojis(ue === "true");
      if (uh != null) setUseHashtags(uh === "true");
      if (mp) setModelProvider(mp as "claude" | "gpt5");
      if (gm && isGpt5Model(gm)) setGpt5Model(gm);
      if (re && isReasoningEffort(re)) setReasoningEffort(re);
      if (v && isVerbosity(v)) setVerbosity(v);
    } catch {}
    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("anthropic_key", anthropicKey);
    } catch {}
  }, [anthropicKey]);

  useEffect(() => {
    try {
      localStorage.setItem("openai_key", openaiKey);
    } catch {}
  }, [openaiKey]);

  useEffect(() => {
    try {
      localStorage.setItem("use_emojis", String(useEmojis));
    } catch {}
  }, [useEmojis]);

  useEffect(() => {
    try {
      localStorage.setItem("use_hashtags", String(useHashtags));
    } catch {}
  }, [useHashtags]);

  useEffect(() => {
    try {
      localStorage.setItem("model_provider", modelProvider);
    } catch {}
  }, [modelProvider]);

  useEffect(() => {
    try {
      localStorage.setItem("gpt5_model", gpt5Model);
    } catch {}
  }, [gpt5Model]);

  useEffect(() => {
    try {
      localStorage.setItem("reasoning_effort", reasoningEffort);
    } catch {}
  }, [reasoningEffort]);

  useEffect(() => {
    try {
      localStorage.setItem("verbosity", verbosity);
    } catch {}
  }, [verbosity]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="max-w-7xl mx-auto px-5 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 border border-black/5 shadow-sm">
              <span className="text-xs text-gray-600">
                Reddit → Sorani → Image
              </span>
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
                Kurdish LinkedIn Post Generator
              </span>
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Search trending Reddit topics, transform to polished Sorani posts
              with your preferred style and hook, and generate a matching
              visual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Left content */}
          <div className="lg:col-span-8 space-y-4">
            {/* Search header */}
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className="w-full border rounded-xl pl-10 pr-3 py-3 bg-white"
                    value={query}
                    placeholder="Search Reddit niche (e.g., AI marketing, startups, productivity)"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔎
                  </span>
                </div>
                <select
                  className="border rounded-xl px-2 py-2 bg-white"
                  value={timeframe}
                  onChange={(e) =>
                    setTimeframe(
                      e.target.value as
                        | "hour"
                        | "day"
                        | "week"
                        | "month"
                        | "year"
                        | "all"
                    )
                  }
                  title="Top timeframe"
                >
                  <option value="hour">Top last hour</option>
                  <option value="day">Top today</option>
                  <option value="week">Top this week</option>
                  <option value="month">Top this month</option>
                  <option value="year">Top this year</option>
                  <option value="all">Top all time</option>
                </select>
                <select
                  className="border rounded-xl px-2 py-2 bg-white"
                  value={order}
                  onChange={(e) =>
                    setOrder(e.target.value as "upvotes" | "comments" | "none")
                  }
                  title="Sort order"
                >
                  <option value="upvotes">Most upvotes</option>
                  <option value="comments">Most comments</option>
                  <option value="none">Default order</option>
                </select>
                <button
                  className="px-4 py-3 rounded-xl text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-60"
                  onClick={doSearch}
                  disabled={loadingSearch}
                >
                  {loadingSearch ? "Searching…" : "Search"}
                </button>
              </div>
            </div>

            {/* Results + Selected */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-black/5 bg-white p-3 max-h-[520px] overflow-auto">
                <h4 className="text-sm font-medium mb-2">Results</h4>
                <div className="space-y-2">
                  {loadingSearch && (
                    <div className="animate-pulse space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-lg bg-gray-100" />
                      ))}
                    </div>
                  )}
                  {posts?.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickPost(p.permalink)}
                      className={`block w-full text-left rounded-lg border p-3 transition hover:bg-gray-50 ${
                        selectedPermalink === p.permalink
                          ? "border-indigo-500 bg-indigo-50/60"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="text-xs text-gray-500">
                        r/{p.subreddit} • {p.num_comments} comments •{" "}
                        {formatRelativeTime(p.created_utc)}
                      </div>
                      <div className="font-medium line-clamp-2">{p.title}</div>
                      {p.selftext && (
                        <div className="text-xs text-gray-600 line-clamp-2 mt-1">
                          {p.selftext}
                        </div>
                      )}
                    </button>
                  ))}
                  {!posts?.length && !loadingSearch && (
                    <div className="text-sm text-gray-500">No results</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-black/5 bg-white p-3">
                <h4 className="text-sm font-medium mb-2">Selected</h4>
                {(() => {
                  const selected = posts?.find(
                    (p) => p.permalink === selectedPermalink
                  );
                  return selected ? (
                    <div className="text-xs text-gray-500 mb-2">
                      r/{selected.subreddit} • {selected.num_comments} comments
                      • {formatRelativeTime(selected.created_utc)}
                    </div>
                  ) : null;
                })()}
                {loadingPost ? (
                  <div className="h-64 rounded-lg border bg-white/60 p-3 animate-pulse space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-4 rounded bg-gray-100" />
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="h-64 w-full resize-none rounded-lg border bg-white/60 p-3"
                    value={selectedText}
                    onChange={(e) => setSelectedText(e.target.value)}
                    placeholder="Select a post, or paste/edit content here"
                  />
                )}

                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-gray-500">
                    Using:{" "}
                    {modelProvider === "claude"
                      ? "Claude (Anthropic)"
                      : `GPT-5 ${
                          gpt5Model.split("-").pop()?.toUpperCase() || ""
                        } (OpenAI)`}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 disabled:opacity-60"
                    onClick={modelProvider === "claude" ? runClaude : runGPT5}
                    disabled={!selectedText || loadingClaude}
                  >
                    {loadingClaude ? "Generating Sorani…" : "Generate Sorani"}
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60"
                    onClick={runImage}
                    disabled={!imagePrompt || loadingImage}
                  >
                    {loadingImage ? "Generating Image…" : "Generate Image"}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview / Image Tabs */}
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="flex gap-2 mb-4">
                <button
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    activeTab === "preview"
                      ? "bg-gray-50 border-gray-300"
                      : "bg-white"
                  }`}
                  onClick={() => setActiveTab("preview")}
                >
                  LinkedIn Preview
                </button>
                <button
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    activeTab === "image"
                      ? "bg-gray-50 border-gray-300"
                      : "bg-white"
                  }`}
                  onClick={() => setActiveTab("image")}
                >
                  Image
                </button>
                <div className="flex-1" />
                {activeTab === "preview" ? (
                  <button
                    className="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50"
                    onClick={() => navigator.clipboard.writeText(sorani)}
                    disabled={!sorani}
                  >
                    Copy text
                  </button>
                ) : (
                  <button
                    className="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50"
                    onClick={() => {
                      if (!imageB64) return;
                      const link = document.createElement("a");
                      link.href = `data:image/png;base64,${imageB64}`;
                      link.download = "generated.png";
                      link.click();
                    }}
                    disabled={!imageB64}
                  >
                    Download
                  </button>
                )}
              </div>

              {activeTab === "preview" ? (
                <div
                  dir="rtl"
                  lang="ckb"
                  className="rounded-xl border bg-white/90 overflow-hidden max-w-[680px] mx-auto"
                >
                  <div className="flex items-start gap-3 p-3 flex-row-reverse">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex-1 text-right">
                      <div className="text-sm font-semibold">ناوی تۆ</div>
                      <div className="text-[11px] text-gray-500">
                        کاتێك: ئێستا • Public
                      </div>
                    </div>
                  </div>
                  <div
                    className="px-3 pb-3 whitespace-pre-wrap text-right leading-relaxed outline-none"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) =>
                      setSorani((e.target as HTMLDivElement).innerText)
                    }
                  >
                    {sorani || "—"}
                  </div>
                  {imageB64 ? (
                    <div className="w-full bg-black/5">
                      <NextImage
                        alt="generated"
                        src={`data:image/png;base64,${imageB64}`}
                        width={1536}
                        height={1024}
                        className="w-full h-auto"
                      />
                    </div>
                  ) : null}
                  <div className="border-t px-3 py-2 text-[11px] text-gray-500 flex items-center justify-between">
                    <span>👍 0 • 💬 0</span>
                    <span>↗️ Share</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="min-h-[240px] flex items-center justify-center rounded-lg border bg-white/60">
                    {imageB64 ? (
                      <NextImage
                        alt="generated"
                        src={`data:image/png;base64,${imageB64}`}
                        width={1024}
                        height={1024}
                        className="max-h-[420px] w-auto h-auto rounded-lg shadow"
                      />
                    ) : (
                      <div className="text-sm text-gray-500">—</div>
                    )}
                  </div>
                  <h3 className="text-sm mt-3 text-gray-600">Prompt</h3>
                  <textarea
                    className="text-sm w-full min-h-[100px] resize-y rounded-lg border bg-white/60 p-3"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Write or edit the image prompt..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar (sticky) */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <h3 className="font-medium mb-3">Style & Hook</h3>
                <label className="block text-xs font-medium text-gray-600">
                  Style
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-white mb-2"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    "Professional, concise",
                    "Story-driven, warm",
                    "Bold, punchy",
                    "Educational, structured",
                  ].map((s) => (
                    <button
                      key={s}
                      className="text-xs px-2.5 py-1 rounded-full border hover:bg-gray-50"
                      onClick={() => setStyle(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <label className="block text-xs font-medium text-gray-600">
                  Hook
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-white mb-2"
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    "Question hook",
                    "Bold claim",
                    "Counter-intuitive insight",
                    "Short story",
                  ].map((h) => (
                    <button
                      key={h}
                      className="text-xs px-2.5 py-1 rounded-full border hover:bg-gray-50"
                      onClick={() => setHook(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    id="use-emojis"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={useEmojis}
                    onChange={(e) => setUseEmojis(e.target.checked)}
                  />
                  <label htmlFor="use-emojis" className="text-sm text-gray-700">
                    Use emojis in the post (emoji bullets and numbers)
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="use-hashtags"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={useHashtags}
                    onChange={(e) => setUseHashtags(e.target.checked)}
                  />
                  <label
                    htmlFor="use-hashtags"
                    className="text-sm text-gray-700"
                  >
                    Include relevant hashtags at the end
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative w-full max-w-lg mx-auto rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Settings</h3>
              <button
                className="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Anthropic
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                    placeholder="anthropic_key"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                  />
                  <button
                    className="px-3 py-2 text-xs rounded-lg border bg-white hover:bg-gray-50"
                    onClick={() => setShowAnthropicKey((s) => !s)}
                  >
                    {showAnthropicKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  OpenAI
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type={showOpenAIKey ? "text" : "password"}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                    placeholder="openai_key"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                  <button
                    className="px-3 py-2 text-xs rounded-lg border bg-white hover:bg-gray-50"
                    onClick={() => setShowOpenAIKey((s) => !s)}
                  >
                    {showOpenAIKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Model Provider
                </label>
                <div className="flex gap-2 mt-1">
                  <button
                    className={`px-3 py-2 text-xs rounded-lg border ${
                      modelProvider === "claude"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-600"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setModelProvider("claude")}
                  >
                    Claude (Anthropic)
                  </button>
                  <button
                    className={`px-3 py-2 text-xs rounded-lg border ${
                      modelProvider === "gpt5"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-600"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setModelProvider("gpt5")}
                  >
                    GPT-5 (OpenAI)
                  </button>
                </div>
              </div>

              {/* GPT-5 Settings */}
              {modelProvider === "gpt5" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      GPT-5 Model
                    </label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white mt-1"
                      value={gpt5Model}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (isGpt5Model(value)) setGpt5Model(value);
                      }}
                    >
                      <option value="gpt-5">GPT-5 (Complex tasks)</option>
                      <option value="gpt-5-mini">GPT-5 Mini (Balanced)</option>
                      <option value="gpt-5-nano">GPT-5 Nano (Fast)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Reasoning Effort
                    </label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white mt-1"
                      value={reasoningEffort}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (isReasoningEffort(value)) setReasoningEffort(value);
                      }}
                    >
                      <option value="minimal">Minimal (Fastest)</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (Most thorough)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Output Verbosity
                    </label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white mt-1"
                      value={verbosity}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (isVerbosity(value)) setVerbosity(value);
                      }}
                    >
                      <option value="low">Low (Concise)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (Detailed)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
