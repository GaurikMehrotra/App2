import { usePostLimit } from "@app2/core/src/usePostLimit";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import { usePreferences } from "@app2/core/src/preferences";
import { Media } from "../components/Media";
import { Link } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Switch, Pressable } from "react-native";
import { api, Button, Field, useAuth, configured, colors } from "@app2/core";
import { Feed, loadFeed, Post } from "@app2/core/src/feed";
import { hostileReply, Ranking, validatePost } from "@app2/core/src/domain";
import { Language, languages, translateUI } from "@app2/core/src/i18n";
export default function Conversations() {
  const { session } = useAuth();
  const postLimit = usePostLimit();
  const [feed, setFeed] = useState<Feed>("Following");
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const { preferences, update } = usePreferences();
  const { suggested, ranking, language } = preferences;
  const setSuggested = (v: boolean) => update({ suggested: v });
  const setRanking = (v: Ranking) => update({ ranking: v });
  const setLanguage = (v: Language) => update({ language: v });
  const [reply, setReply] = useState<string | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = (key: Parameters<typeof translateUI>[1]) =>
    translateUI(language, key);
  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      setPosts(
        await loadFeed(
          feed,
          session?.user.id,
          ranking,
          undefined,
          query,
          language,
        ),
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not load feed");
    }
  }, [feed, session, ranking, query, language]);
  useEffect(() => {
    void refresh();
    const channel = api
      .channel("public-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void api.removeChannel(channel);
    };
  }, [refresh]);
  async function publish() {
    if (!session) {
      setStatus("Sign in to publish.");
      return;
    }
    try {
      const text = validatePost(body, postLimit);
      if (reply && hostileReply(text) && !confirmed) {
        setStatus(
          "This reply may hurt the conversation. Review it, or select Send anyway.",
        );
        setConfirmed(true);
        return;
      }
      setBusy(true);
      const { error } = await api.from("posts").insert({
        author_id: session.user.id,
        body: text,
        language,
        reply_to: reply,
        quote_of: quote,
        ai_generated: ai,
      });
      if (error) throw error;
      setBody("");
      setReply(null);
      setQuote(null);
      setConfirmed(false);
      await refresh();
      setStatus("Published.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  }
  async function action(
    table: "likes" | "reposts" | "bookmarks" | "not_helpful",
    id: string,
  ) {
    if (!session) {
      setStatus("Sign in to interact.");
      return;
    }
    const existing = await api
      .from(table)
      .select("post_id")
      .eq("user_id", session.user.id)
      .eq("post_id", id)
      .maybeSingle();
    if (existing.error) {
      setStatus(existing.error.message);
      return;
    }
    const { error } = existing.data
      ? await api
          .from(table)
          .delete()
          .eq("user_id", session.user.id)
          .eq("post_id", id)
      : await api.from(table).insert({ user_id: session.user.id, post_id: id });
    setStatus(error?.message || (existing.data ? "Removed." : "Saved."));
    await refresh();
  }
  async function report(p: Post) {
    if (!session) return;
    const { error } = await api.from("reports").insert({
      reporter_id: session.user.id,
      post_id: p.id,
      reason: "Requested moderator review",
    });
    setStatus(error?.message || "Report submitted for review.");
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
        maxWidth: 850,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Text style={{ fontSize: 14, color: colors.accent, letterSpacing: 3 }}>
        APP_NAME_2 / PUBLIC SQUARE
      </Text>
      <Text style={{ fontSize: 36, color: colors.ink, marginVertical: 14 }}>
        {t("conversations")}
      </Text>
      <Text style={{ color: colors.ink }}>
        Your people. Your perspective. Your choice.
      </Text>
      <Link href="/compose">Write with images, voice or polls →</Link>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginVertical: 12,
        }}
      >
        {(Object.keys(languages) as Language[]).map((l) => (
          <Pressable
            key={l}
            accessibilityRole="button"
            onPress={() => setLanguage(l)}
          >
            <Text
              style={{
                padding: 8,
                color: colors.ink,
                fontWeight: l === language ? "bold" : "normal",
              }}
            >
              {l.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch
          accessibilityLabel="Opt in to Suggested feed"
          value={suggested}
          onValueChange={(v) => {
            setSuggested(v);
            if (!v && feed === "Suggested") setFeed("Following");
          }}
        />
        <LocalizedText>Opt in to Suggested</LocalizedText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            "Following",
            "Topics",
            "Local",
            "Explore",
            ...(suggested ? ["Suggested"] : []),
          ] as Feed[]
        ).map((f) => (
          <Button
            key={f}
            title={`${feed === f ? "● " : ""}${t(f.toLowerCase() as "following")}`}
            onPress={() => setFeed(f)}
          />
        ))}
      </View>
      {feed === "Suggested" && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["Latest", "Balanced", "Most helpful"] as Ranking[]).map((r) => (
            <Button key={r} title={r} onPress={() => setRanking(r)} />
          ))}
        </View>
      )}
      <Field label="Search posts" value={query} onChangeText={setQuery} />
      {session && (
        <View
          style={{
            padding: 16,
            backgroundColor: "white",
            borderRadius: 16,
            marginVertical: 14,
          }}
        >
          <Field
            label={
              reply
                ? "Write a reply"
                : quote
                  ? "Quote this conversation"
                  : t("compose")
            }
            value={body}
            onChangeText={(v) => {
              setBody(v);
              setConfirmed(false);
            }}
            multiline
          />
          <Text>
            {[...body].length}/{postLimit}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Switch
              accessibilityLabel="AI-generated content"
              value={ai}
              onValueChange={setAi}
            />
            <LocalizedText>AI-generated content</LocalizedText>
          </View>
          <Button
            title={confirmed ? "Send anyway" : t("post")}
            onPress={() => void publish()}
            disabled={busy}
          />
          {(reply || quote) && (
            <Button
              title="Cancel reply / quote"
              onPress={() => {
                setReply(null);
                setQuote(null);
              }}
            />
          )}
        </View>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
      {!configured && (
        <Text style={{ padding: 16 }}>
          Connect Supabase to join live conversations. The interface is ready;
          accounts and posts need a database.
        </Text>
      )}
      {!posts.length && (
        <Text style={{ paddingVertical: 24 }}>{t("empty")}</Text>
      )}
      {posts.map((p) => (
        <View
          key={p.id}
          style={{
            padding: 20,
            backgroundColor: "white",
            borderRadius: 16,
            marginVertical: 8,
          }}
        >
          <Text style={{ fontWeight: "bold", color: colors.ink }}>
            {p.profiles?.display_name || p.profiles?.handle || "Member"} @
            {p.profiles?.handle}
          </Text>
          {p.profiles?.account_kind && p.profiles.account_kind !== "person" && (
            <Text>Verified {p.profiles.account_kind} account</Text>
          )}
          {p.profiles?.verified_student && (
            <LocalizedText>Verified student</LocalizedText>
          )}
          <Link href={{ pathname: "/post/[id]", params: { id: p.id } }}>
            <Text
              style={{
                fontSize: 18,
                lineHeight: 27,
                marginVertical: 12,
                color: colors.ink,
              }}
            >
              {p.body}
            </Text>
          </Link>
          {p.promoted && <LocalizedText>Promoted</LocalizedText>}
          {p.context_label && <Text>Community context: {p.context_label}</Text>}
          <Media postId={p.id} />
          {p.ai_generated && (
            <LocalizedText>AI-generated · self-declared</LocalizedText>
          )}
          {p.quote_of && <Text>Quotes conversation {p.quote_of}</Text>}
          <Text>
            {new Date(p.created_at).toLocaleString()} · {p.language}
          </Text>
          {p.reason && (
            <Text>
              {t("why")} {p.reason}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              title={`Like · ${p.like_count}`}
              onPress={() => void action("likes", p.id)}
            />
            <Button title="Reply" onPress={() => setReply(p.id)} />
            <Button title="Quote" onPress={() => setQuote(p.id)} />
            <Button
              title="Repost"
              onPress={() => void action("reposts", p.id)}
            />
            <Button
              title="Bookmark"
              onPress={() => void action("bookmarks", p.id)}
            />
            <Button
              title="Not helpful"
              onPress={() => void action("not_helpful", p.id)}
            />
            <Button title="Report" onPress={() => void report(p)} />
          </View>
        </View>
      ))}
      {posts.length === 25 && (
        <Button
          title="Load more"
          onPress={() => {
            const last = posts[posts.length - 1];
            void loadFeed(
              feed,
              session?.user.id,
              ranking,
              {
                time: last.feed_time || last.created_at,
                id: last.id,
                score: last.rank_score,
              },
              query,
              language,
            )
              .then((next) => setPosts((old) => [...old, ...next]))
              .catch((e) => setStatus(String(e)));
          }}
        />
      )}
    </ScrollView>
  );
}
