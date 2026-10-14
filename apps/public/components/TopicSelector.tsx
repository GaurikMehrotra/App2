import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { api, Button, useAuth } from "@app2/core";
export function TopicSelector() {
  const { session } = useAuth();
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!session) return;
    void api
      .from("topics")
      .select("id,name")
      .then(({ data }) => setTopics(data || []));
    void api
      .from("profile_topics")
      .select("topic_id")
      .eq("user_id", session.user.id)
      .then(({ data }) => setChosen((data || []).map((t) => t.topic_id)));
  }, [session]);
  async function toggle(id: string) {
    if (!session) return;
    const active = chosen.includes(id);
    const result = active
      ? await api
          .from("profile_topics")
          .delete()
          .eq("user_id", session.user.id)
          .eq("topic_id", id)
      : await api
          .from("profile_topics")
          .insert({ user_id: session.user.id, topic_id: id });
    if (result.error) setStatus(result.error.message);
    else setChosen((v) => (active ? v.filter((x) => x !== id) : [...v, id]));
  }
  return (
    <View>
      <Text>Choose your topics as you set up your account</Text>
      {topics.map((t) => (
        <Button
          key={t.id}
          title={`${chosen.includes(t.id) ? "✓ " : ""}${t.name}`}
          onPress={() => void toggle(t.id)}
        />
      ))}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </View>
  );
}
