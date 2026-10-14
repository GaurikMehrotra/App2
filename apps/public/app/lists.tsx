import React, { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Link } from "expo-router";
import { api, Button, Field, useAuth, colors } from "@app2/core";
export default function Lists() {
  const { session } = useAuth();
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [handle, setHandle] = useState("");
  const [posts, setPosts] = useState<
    { id: string; body: string; created_at: string }[]
  >([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (session)
      void api
        .from("lists")
        .select("*")
        .eq("owner_id", session.user.id)
        .then(({ data, error }) => {
          setLists(data || []);
          if (error) setStatus(error.message);
        });
  }, [session]);
  async function open(id: string) {
    setSelected(id);
    const { data, error } = await api.rpc("get_list_feed", { chosen: id });
    setPosts(data || []);
    setStatus(error?.message || "");
  }
  async function add(remove: boolean) {
    const { data: person, error } = await api
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .single();
    if (error) {
      setStatus(error.message);
      return;
    }
    const result = remove
      ? await api
          .from("list_members")
          .delete()
          .eq("list_id", selected)
          .eq("profile_id", person.id)
      : await api
          .from("list_members")
          .upsert({ list_id: selected, profile_id: person.id });
    setStatus(result.error?.message || (remove ? "Removed" : "Added"));
    await open(selected);
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28 }}>Your custom lists</Text>
      {lists.map((l) => (
        <Button key={l.id} title={l.name} onPress={() => void open(l.id)} />
      ))}
      {selected && (
        <>
          <Field
            label="Member handle"
            value={handle}
            onChangeText={setHandle}
          />
          <Button title="Add member" onPress={() => void add(false)} />
          <Button title="Remove member" onPress={() => void add(true)} />
          {posts.map((p) => (
            <Link
              key={p.id}
              href={{ pathname: "/post/[id]", params: { id: p.id } }}
            >
              {p.body}
            </Link>
          ))}
          {posts.length === 25 && (
            <Button
              title="Load more"
              onPress={() => {
                const last = posts[posts.length - 1];
                void api
                  .rpc("get_list_feed", {
                    chosen: selected,
                    before_time: last.created_at,
                    before_id: last.id,
                  })
                  .then(({ data, error }) => {
                    if (error) setStatus(error.message);
                    else setPosts((old) => [...old, ...(data || [])]);
                  });
              }}
            />
          )}
        </>
      )}
      <Text>{status}</Text>
    </ScrollView>
  );
}
