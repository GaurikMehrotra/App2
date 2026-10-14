import {RequestHistory} from "../components/RequestHistory";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import { NotificationPreferences } from "../components/NotificationPreferences";
import { Link } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, Switch } from "react-native";
import { api, Button, Field, useAuth, colors } from "@app2/core";
type Topic = { id: string; name: string };
type Notification = { id: string; kind: string; read_at: string | null };
export default function Controls() {
  const { session } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [handle, setHandle] = useState("");
  const [list, setList] = useState("");
  const [reason, setReason] = useState("");
  const [organization, setOrganization] = useState("");
  const [status, setStatus] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    void api
      .from("topics")
      .select("*")
      .then(({ data }) => setTopics(data || []));
    if (!session) return;
    void api
      .from("profile_topics")
      .select("topic_id")
      .eq("user_id", session.user.id)
      .then(({ data }) => setSelected((data || []).map((t) => t.topic_id)));
    const load = () => {
      void api
        .from("notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data }) => setNotifications(data || []));
    };
    load();
    const channel = api
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq." + session.user.id,
        },
        load,
      )
      .subscribe();
    return () => {
      void api.removeChannel(channel);
    };
  }, [session]);
  async function topic(id: string) {
    if (!session) return;
    const active = selected.includes(id);
    const { error } = active
      ? await api
          .from("profile_topics")
          .delete()
          .eq("user_id", session.user.id)
          .eq("topic_id", id)
      : await api
          .from("profile_topics")
          .insert({ user_id: session.user.id, topic_id: id });
    if (error) setStatus(error.message);
    else setSelected((v) => (active ? v.filter((t) => t !== id) : [...v, id]));
  }
  async function accountAction(block: boolean) {
    if (!session) return;
    const { data, error } = await api
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .single();
    if (error) {
      setStatus(error.message);
      return;
    }
    const result = block
      ? await api
          .from("blocks")
          .upsert({ owner_id: session.user.id, target_id: data.id })
      : await api
          .from("mutes")
          .insert({ owner_id: session.user.id, account_id: data.id });
    setStatus(result.error?.message || "Saved");
  }
  async function request(
    table: "appeals" | "verification_requests" | "privacy_requests",
    kind?: string,
  ) {
    if (!session) return;
    const { error } = await api.from(table).insert({
      user_id: session.user.id,
      ...(table === "appeals" ? { reason } : { kind }),
      ...(kind === "organization"
        ? { organization_name: organization, requested_kind: "official" }
        : {}),
    });
    setStatus(error?.message || "Request submitted; operator review required.");
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <LocalizedText style={{ fontSize: 28 }}>Your controls</LocalizedText>
      <View style={{ gap: 12, marginVertical: 16 }}>
        {(
          [
            "compose",
            "search",
            "messages",
            "creators",
            "events",
            "moderation",
            "grievance",
            "trends",
            "lists",
            "communities",
          ] as const
        ).map((route) => (
          <Link key={route} href={`/${route}`}>
            {route.toUpperCase()}
          </Link>
        ))}
      </View>
      {!session ? (
        <LocalizedText>Sign in to manage preferences.</LocalizedText>
      ) : (
        <>
          <LocalizedText style={{ fontSize: 20 }}>
            Choose your topics
          </LocalizedText>
          {topics.map((t) => (
            <Button
              key={t.id}
              title={(selected.includes(t.id) ? "✓ " : "") + t.name}
              onPress={() => void topic(t.id)}
            />
          ))}
          <Field label="Muted word" value={word} onChangeText={setWord} />
          <Button
            title="Mute word"
            onPress={() => {
              void api
                .from("mutes")
                .insert({ owner_id: session.user.id, word })
                .then(({ error }) => setStatus(error?.message || "Muted"));
            }}
          />
          <Field
            label="Account handle"
            value={handle}
            onChangeText={setHandle}
          />
          <Button
            title="Mute account"
            onPress={() => void accountAction(false)}
          />
          <Button
            title="Block account"
            onPress={() => void accountAction(true)}
          />
          <Field label="Custom list name" value={list} onChangeText={setList} />
          <Button
            title="Create list"
            onPress={() => {
              void api
                .from("lists")
                .insert({ owner_id: session.user.id, name: list })
                .then(({ error }) =>
                  setStatus(error?.message || "List created"),
                );
            }}
          />
          <LocalizedText style={{ fontSize: 20 }}>Notifications</LocalizedText>
          <RequestHistory/><NotificationPreferences />
          {notifications.map((n) => (
            <View key={n.id}>
              <Text>
                {n.kind}
                {n.read_at ? " · read" : ""}
              </Text>
              <Button
                title="Mark read"
                onPress={() => {
                  void api
                    .from("notifications")
                    .update({ read_at: new Date().toISOString() })
                    .eq("id", n.id)
                    .then(({ error }) =>
                      setStatus(error?.message || "Marked read"),
                    );
                }}
              />
            </View>
          ))}
          <LocalizedText style={{ fontSize: 20 }}>
            Trust and privacy
          </LocalizedText>
          <Button
            title="Request human verification"
            onPress={() => void request("verification_requests", "human")}
          />
          <Field
            label="Organization name"
            value={organization}
            onChangeText={setOrganization}
          />
          <Button
            title="Request organization verification"
            onPress={() =>
              void request("verification_requests", "organization")
            }
          />
          <Field
            label="Appeal reason"
            value={reason}
            onChangeText={setReason}
          />
          <Button
            title="Submit appeal"
            onPress={() => void request("appeals")}
          />
          <Text>
            Account export and deletion requests require operator processing.
          </Text>
          <Button
            title="Request data export"
            onPress={() => void request("privacy_requests", "export")}
          />
          <Button
            title="Request account deletion"
            onPress={() => void request("privacy_requests", "delete")}
          />
          <Switch
            accessibilityLabel="Analytics consent"
            value={consent}
            onValueChange={(v) => {
              setConsent(v);
              void api
                .from("consents")
                .upsert({
                  user_id: session.user.id,
                  purpose: "analytics",
                  granted: v,
                  version: "1",
                })
                .then(({ error }) =>
                  setStatus(error?.message || "Consent saved"),
                );
            }}
          />
          <LocalizedText>Optional analytics consent</LocalizedText>
        </>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
