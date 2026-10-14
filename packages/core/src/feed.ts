import { api } from "./index";
import { Ranking } from "./domain";
export type Post = {
  id: string;
  author_id: string;
  body: string;
  language: string;
  created_at: string;
  like_count: number;
  reply_to: string | null;
  quote_of: string | null;
  ai_generated: boolean;
  promoted?: boolean;
  context_label?: string | null;
  profiles: {
    handle: string;
    display_name: string;
    verified_student: boolean;
    account_kind?: string;
  } | null;
  reason?: string;
  rank_score?: number;
  feed_time?: string;
};
export type Feed = "Following" | "Topics" | "Local" | "Explore" | "Suggested";
export async function loadFeed(
  feed: Feed,
  userId: string | undefined,
  ranking: Ranking,
  cursor?: { time: string; id: string; score?: number },
  query = "",
  language = "en",
) {
  if (!query) {
    const { data, error } = await api.rpc("get_feed", {
      mode: feed,
      style: feed === "Suggested" ? ranking : "Latest",
      lang: language,
      before_time: cursor?.time || null,
      before_id: cursor?.id || null,
      before_score: cursor?.score ?? null,
    });
    if (error) throw error;
    return (data || []) as Post[];
  }
  let request = api
    .from("posts")
    .select(
      "*,profiles!posts_author_id_fkey(handle,display_name,verified_student)",
    )
    .is("reply_to", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(25);
  if (cursor)
    request = request.or(
      `created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},id.lt.${cursor.id})`,
    );
  if (query)
    request = request
      .textSearch("body", query, { config: "simple", type: "websearch" })
      .eq("language", language);
  if (feed === "Following") {
    if (!userId) return [];
    const { data, error } = await api
      .from("follows")
      .select("followee_id")
      .eq("follower_id", userId);
    if (error) throw error;
    request = request.in("author_id", [
      userId,
      ...(data || []).map((r) => r.followee_id),
    ]);
  }
  if (feed === "Topics") {
    if (!userId) return [];
    const { data } = await api
      .from("profile_topics")
      .select("topic_id")
      .eq("user_id", userId);
    const { data: edges } = await api
      .from("post_topics")
      .select("post_id")
      .in(
        "topic_id",
        (data || []).map((t) => t.topic_id),
      );
    request = request.in(
      "id",
      (edges || []).map((e) => e.post_id),
    );
  }
  if (feed === "Local") {
    if (!userId) return [];
    const { data } = await api
      .from("profiles")
      .select("city")
      .eq("id", userId)
      .single();
    if (!data?.city) return [];
    request = request.eq("city", data.city);
  }
  const { data, error } = await request;
  if (error) throw error;
  let posts = (data || []) as Post[];
  if (userId) {
    const { data: mutes } = await api
      .from("mutes")
      .select("*")
      .eq("owner_id", userId);
    posts = posts.filter(
      (p) =>
        !(mutes || []).some(
          (m) =>
            m.account_id === p.author_id ||
            (m.word && p.body.toLowerCase().includes(m.word.toLowerCase())),
        ),
    );
  }

  return feed === "Suggested"
    ? posts.map((p) => ({
        ...p,
        reason: "Matches your search in the chosen language",
      }))
    : posts;
}
