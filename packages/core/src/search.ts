import { api } from "./index";
export type SearchResult = {
  id: string;
  label: string;
  kind: "post" | "person" | "hashtag" | "topic";
};
export interface SearchEngine {
  search(query: string, language: string): Promise<SearchResult[]>;
}
export class PostgresSearch implements SearchEngine {
  async search(query: string, language: string) {
    const term = query.replace(/[%_]/g, "").slice(0, 100);
    const results = await Promise.all([
      api
        .from("posts")
        .select("id,body")
        .eq("language", language)
        .textSearch("body", term, { config: "simple", type: "websearch" })
        .limit(20),
      api
        .from("profiles")
        .select("id,handle,display_name")
        .or(
          `handle.ilike.%${term.replace(/[,().]/g, "")}%,display_name.ilike.%${term.replace(/[,().]/g, "")}%`,
        )
        .limit(20),
      api
        .from("hashtags")
        .select("id,name")
        .ilike("name", `%${term}%`)
        .limit(20),
      api.from("topics").select("id,name").ilike("name", `%${term}%`).limit(20),
    ]);
    for (const r of results) if (r.error) throw r.error;
    return [
      ...(results[0].data || []).map((p) => ({
        id: p.id,
        label: p.body,
        kind: "post" as const,
      })),
      ...(results[1].data || []).map((p) => ({
        id: p.id,
        label: p.display_name + " @" + p.handle,
        kind: "person" as const,
      })),
      ...(results[2].data || []).map((p) => ({
        id: String(p.id),
        label: "#" + p.name,
        kind: "hashtag" as const,
      })),
      ...(results[3].data || []).map((p) => ({
        id: p.id,
        label: p.name,
        kind: "topic" as const,
      })),
    ];
  }
}
export const searchEngine: SearchEngine = new PostgresSearch();
