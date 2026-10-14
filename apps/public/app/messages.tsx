import { LocalizedText } from "@app2/core/src/LocalizedText";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, Button, Field, useAuth, colors } from "@app2/core";
type Chat = { id: string; name: string | null; kind: string };
type Message = { id: string; body: string; sender_id: string };
export default function Messages() {
  const { session } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [invite, setInvite] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<"direct" | "group" | "room">("direct");
  const [requests, setRequests] = useState<
    { conversation_id: string; name: string | null; inviter_handle: string }[]
  >([]);
  async function refresh() {
    if (!session) return;
    const { data, error } = await api
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setStatus(error.message);
    setChats(data || []);
    const { data: pending } = await api.rpc("message_requests");
    setRequests(pending || []);
  }
  useEffect(() => {
    void refresh();
  }, [session]);
  useEffect(() => {
    if (!selected) return;
    const load = () => {
      void api
        .from("messages")
        .select("*")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          setMessages((data || []).reverse());
          if (error) setStatus(error.message);
        });
    };
    load();
    const channel = api
      .channel("messages-" + selected)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + selected,
        },
        load,
      )
      .subscribe();
    return () => {
      void api.removeChannel(channel);
    };
  }, [selected]);
  async function create() {
    if (!session) return;
    const { data: person, error: findError } = await api
      .from("profiles")
      .select("id")
      .eq("handle", invite)
      .single();
    if (findError || !person) {
      setStatus("Handle not found");
      return;
    }
    const { data, error } = await api
      .from("conversations")
      .insert({
        owner_id: session.user.id,
        name: name || null,
        kind,
      })
      .select()
      .single();
    if (error || !data) {
      setStatus(error?.message || "Could not create conversation");
      return;
    }
    const result = await api.from("conversation_members").insert([
      { conversation_id: data.id, user_id: session.user.id, accepted: true },
      { conversation_id: data.id, user_id: person.id, accepted: false },
    ]);
    setStatus(
      result.error?.message ||
        "Request sent. Recipient must accept before reading messages.",
    );
    await refresh();
    setSelected(data.id);
  }
  async function send() {
    if (!session || !selected || !body.trim()) return;
    const { error } = await api.from("messages").insert({
      conversation_id: selected,
      sender_id: session.user.id,
      body: body.trim(),
    });
    setStatus(error?.message || "Sent");
    if (!error) setBody("");
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <LocalizedText style={{ fontSize: 28 }}>Messages</LocalizedText>
      <Text>
        Private membership controls. End-to-end encryption is a later milestone.
      </Text>
      {!session ? (
        <LocalizedText>Sign in to use messaging.</LocalizedText>
      ) : (
        <>
          <Button title="Direct message" onPress={() => setKind("direct")} />
          <Button title="Small group" onPress={() => setKind("group")} />
          <Button title="Community room" onPress={() => setKind("room")} />
          <Field
            label="Invite handle"
            value={invite}
            onChangeText={setInvite}
          />
          <Field
            label="Group name (optional)"
            value={name}
            onChangeText={setName}
          />
          <Button title="Send message request" onPress={() => void create()} />
          {requests.map((request) => (
            <Button
              key={request.conversation_id}
              title={`Accept request from @${request.inviter_handle}`}
              onPress={() => {
                void api
                  .from("conversation_members")
                  .update({ accepted: true })
                  .eq("conversation_id", request.conversation_id)
                  .eq("user_id", session.user.id)
                  .then(({ error }) => {
                    setStatus(error?.message || "Accepted");
                    void refresh();
                  });
              }}
            />
          ))}
          {chats.map((c) => (
            <Button
              key={c.id}
              title={c.name || "Direct conversation"}
              onPress={() => setSelected(c.id)}
            />
          ))}
          {selected && (
            <View>
              <Button
                title="Invite to selected conversation"
                onPress={() => {
                  void api
                    .from("profiles")
                    .select("id")
                    .eq("handle", invite)
                    .single()
                    .then(async ({ data, error }) => {
                      if (error) {
                        setStatus(error.message);
                        return;
                      }
                      const result = await api
                        .from("conversation_members")
                        .insert({
                          conversation_id: selected,
                          user_id: data.id,
                          accepted: false,
                        });
                      setStatus(result.error?.message || "Invited");
                    });
                }}
              />
              {messages.map((m) => (
                <Text
                  key={m.id}
                  style={{ padding: 12, backgroundColor: "white", margin: 4 }}
                >
                  {m.sender_id === session.user.id ? "You" : "Member"}: {m.body}
                </Text>
              ))}
              <Field label="Message" value={body} onChangeText={setBody} />
              <Button title="Send" onPress={() => void send()} />
            </View>
          )}
        </>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
