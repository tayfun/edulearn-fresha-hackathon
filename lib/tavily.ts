export type SearchResult = { title: string; url: string; snippet: string };

/** Web search via Tavily. Returns [] on failure so a search outage never blocks a course. */
export async function webSearch(query: string, maxResults = 4): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.slice(0, 380), max_results: maxResults, search_depth: "basic" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error(`Tavily search failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? [])
      .filter((r) => r.url && /^https?:\/\//.test(r.url))
      .map((r) => ({
        title: (r.title || r.url!).slice(0, 200),
        url: r.url!,
        snippet: (r.content || "").replace(/\s+/g, " ").slice(0, 500),
      }));
  } catch (err) {
    console.error("Tavily search error", err);
    return [];
  }
}
