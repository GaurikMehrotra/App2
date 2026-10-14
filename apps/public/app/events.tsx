import React, { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Link } from "expo-router";
import { api, Button, Field, useAuth, colors } from "@app2/core";
type Event = {
  id: string;
  title: string;
  category: string;
  region: string | null;
};
export default function Events() {
  const { session } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<{ id: string; body: string }[]>([]);
  const [status, setStatus] = useState("");
  const [moderator, setModerator] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState("");
  const [postId, setPostId] = useState("");
  async function load() {
    const { data, error } = await api
      .from("events")
      .select("*")
      .order("starts_at")
      .limit(30);
    setEvents(data || []);
    if (error) setStatus(error.message);
  }
  useEffect(() => {
    void load();
    if (session)
      void api
        .rpc("is_moderator")
        .then(({ data }) => setModerator(Boolean(data)));
  }, [session]);
  async function open(id: string) {
    setSelected(id);
    const { data, error } = await api
      .from("event_posts")
      .select("posts(id,body)")
      .eq("event_id", id);
    if (error) setStatus(error.message);
    else
      setPosts(
        (data || []).flatMap((e) =>
          e.posts ? (Array.isArray(e.posts) ? e.posts : [e.posts]) : [],
        ) as { id: string; body: string }[],
      );
  }
  useEffect(() => {
    if (!selected) return;
    const channel = api
      .channel("event-" + selected)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_posts",
          filter: "event_id=eq." + selected,
        },
        () => void open(selected),
      )
      .subscribe();
    return () => {
      void api.removeChannel(channel);
    };
  }, [selected]);
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28 }}>Live events</Text>
      {events.map((e) => (
        <Button
          key={e.id}
          title={`${e.title} · ${e.category} · ${e.region || "Global"}`}
          onPress={() => void open(e.id)}
        />
      ))}
      {posts.map((p) => (
        <Link
          key={p.id}
          href={{ pathname: "/post/[id]", params: { id: p.id } }}
        >
          {p.body}
        </Link>
      ))}
      {moderator && (
        <>
          <Field label="Event title" value={title} onChangeText={setTitle} />
          <Field label="Category" value={category} onChangeText={setCategory} />
          <Field label="Region" value={region} onChangeText={setRegion} />
          <Button
            title="Create live event"
            onPress={() => {
              void api
                .from("events")
                .insert({
                  title,
                  category,
                  region,
                  starts_at: new Date().toISOString(),
                })
                .then(({ error }) => {
                  setStatus(error?.message || "Created");
                  void load();
                });
            }}
          />
          {selected && (
            <>
              <Field
                label="Relevant post ID"
                value={postId}
                onChangeText={setPostId}
              />
              <Button
                title="Add post to selected event"
                onPress={() => {
                  void api
                    .from("event_posts")
                    .insert({ event_id: selected, post_id: postId })
                    .then(({ error }) => {
                      setStatus(error?.message || "Added");
                      void open(selected);
                    });
                }}
              />
            </>
          )}
        </>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
