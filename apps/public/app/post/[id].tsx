import { usePostLimit } from "@app2/core/src/usePostLimit";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import { Media } from "../../components/Media";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, Switch } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, Button, Field, useAuth, colors } from "@app2/core";
import { hostileReply, validatePost } from "@app2/core/src/domain";
type Row = { id: string; body: string; author_id: string };
type Note = {
  id: string;
  body: string;
  source_url: string;
  published: boolean;
};
type Option = { id: string; label: string; poll_id: string };
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const postLimit = usePostLimit();
  const [post, setPost] = useState<Row | null>(null);
  const [replies, setReplies] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [body, setBody] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [thread, setThread] = useState(false);
  async function refresh() {
    const { data, error } = await api
      .from("posts")
      .select("id,body,author_id")
      .eq("id", id)
      .single();
    if (error) setStatus(error.message);
    setPost(data);
    const result = await api
      .from("posts")
      .select("id,body,author_id")
      .eq("reply_to", id)
      .order("created_at")
      .limit(50);
    setReplies(result.data || []);
    const n = await api.from("notes").select("*").eq("post_id", id);
    setNotes(n.data || []);
    const { data: poll } = await api
      .from("polls")
      .select("id")
      .eq("post_id", id)
      .maybeSingle();
    if (poll) {
      const { data } = await api
        .from("poll_options")
        .select("*")
        .eq("poll_id", poll.id);
      setOptions(data || []);
    }
  }
  useEffect(() => {
    void refresh();
  }, [id]);
  async function reply() {
    if (!session) return;
    try {
      const text = validatePost(body, postLimit);
      if (hostileReply(text) && !confirm) {
        setConfirm(true);
        setStatus("Consider rephrasing this reply.");
        return;
      }
      const { error } = await api.from("posts").insert({
        body: text,
        author_id: session.user.id,
        reply_to: id,
        thread_parent: thread ? id : null,
      });
      if (error) throw error;
      setBody("");
      setConfirm(false);
      await refresh();
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function propose() {
    if (!session) return;
    if (!/^https:\/\//.test(source)) {
      setStatus("Include an HTTPS source");
      return;
    }
    const { error } = await api.from("notes").insert({
      author_id: session.user.id,
      post_id: id,
      body: note,
      source_url: source,
    });
    setStatus(error?.message || "Proposed for eligible raters");
    await refresh();
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <LocalizedText style={{ fontSize: 28 }}>Conversation</LocalizedText>
      <Text style={{ fontSize: 22, marginVertical: 16 }}>{post?.body}</Text>
      {post && <Media postId={post.id} />}{" "}
      {options.map((o) => (
        <Button
          key={o.id}
          title={o.label}
          onPress={() => {
            if (session)
              void api
                .from("poll_votes")
                .insert({
                  poll_id: o.poll_id,
                  option_id: o.id,
                  user_id: session.user.id,
                })
                .then(({ error }) => setStatus(error?.message || "Vote saved"));
          }}
        />
      ))}
      <Button
        title="Translate to Hindi"
        onPress={() => {
          void api.functions
            .invoke("translate", { body: { postId: id, target: "hi" } })
            .then(({ data, error }) =>
              setStatus(
                error?.message || data?.body || data?.error || "Unavailable",
              ),
            );
        }}
      />
      {notes
        .filter((n) => n.published)
        .map((n) => (
          <Text key={n.id}>
            Community context: {n.body} · {n.source_url}
          </Text>
        ))}
      {session && (
        <>
          <Field
            label="Reply"
            value={body}
            onChangeText={(v) => {
              setBody(v);
              setConfirm(false);
            }}
            multiline
          />
          <Switch
            accessibilityLabel="Continue as thread"
            value={thread}
            onValueChange={setThread}
          />
          <Button
            title={confirm ? "Send anyway" : "Reply"}
            onPress={() => void reply()}
          />
          <Field
            label="Propose context (eligible accounts)"
            value={note}
            onChangeText={setNote}
          />
          <Field label="Source URL" value={source} onChangeText={setSource} />
          <Button title="Propose note" onPress={() => void propose()} />
          {notes
            .filter((n) => !n.published)
            .map((n) => (
              <View key={n.id}>
                <Text>Proposed: {n.body}</Text>
                {[true, false].map((helpful) => (
                  <Button
                    key={String(helpful)}
                    title={helpful ? "Helpful" : "Not helpful"}
                    onPress={() => {
                      void api
                        .from("note_ratings")
                        .upsert({
                          note_id: n.id,
                          user_id: session.user.id,
                          helpful,
                        })
                        .then(({ error }) =>
                          setStatus(error?.message || "Rating saved"),
                        );
                    }}
                  />
                ))}
              </View>
            ))}
        </>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
      {replies.map((r) => (
        <Text
          key={r.id}
          style={{ padding: 14, marginVertical: 8, backgroundColor: "white" }}
        >
          {r.body}
        </Text>
      ))}
    </ScrollView>
  );
}
