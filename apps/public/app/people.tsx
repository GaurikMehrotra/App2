import { LocalizedText } from "@app2/core/src/LocalizedText";
import { Link } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  api,
  Button,
  Field,
  Profile,
  useAuth,
  configured,
  colors,
} from "@app2/core";
export default function People() {
  const { session } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!configured) return;
    api
      .from("profiles")
      .select("*")
      .order("handle")
      .limit(50)
      .then(({ data, error }) => {
        setPeople(data || []);
        if (error) setError(error.message);
      });
    if (session)
      api
        .from("follows")
        .select("followee_id")
        .eq("follower_id", session.user.id)
        .then(({ data }) =>
          setFollowing(data?.map((r) => r.followee_id) || []),
        );
  }, [session]);
  async function toggle(id: string) {
    if (!session) return;
    const exists = following.includes(id);
    const { error } = exists
      ? await api
          .from("follows")
          .delete()
          .eq("follower_id", session.user.id)
          .eq("followee_id", id)
      : await api
          .from("follows")
          .insert({ follower_id: session.user.id, followee_id: id });
    if (error) setError(error.message);
    else setFollowing((v) => (exists ? v.filter((x) => x !== id) : [...v, id]));
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <LocalizedText style={{ fontSize: 28 }}>
        People, not popularity
      </LocalizedText>
      <Field label="Find a person" value={query} onChangeText={setQuery} />
      {!configured && (
        <LocalizedText>
          Configure Supabase to load public profiles.
        </LocalizedText>
      )}
      {people
        .filter((p) =>
          (p.handle + " " + p.display_name)
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((p) => (
          <View
            key={p.id}
            style={{
              padding: 16,
              marginVertical: 8,
              backgroundColor: "white",
              borderRadius: 12,
            }}
          >
            <Link
              href={{
                pathname: "/person/[handle]",
                params: { handle: p.handle },
              }}
            >
              <Text style={{ fontSize: 20 }}>
                {p.display_name} @{p.handle}
              </Text>
            </Link>
            {p.verified_student && (
              <LocalizedText>Verified student</LocalizedText>
            )}
            {p.verified_human && <LocalizedText>Verified human</LocalizedText>}
            <Text>{p.bio}</Text>
            {session && session.user.id !== p.id && (
              <Button
                title={following.includes(p.id) ? "Unfollow" : "Follow"}
                onPress={() => void toggle(p.id)}
              />
            )}
          </View>
        ))}
      <Text accessibilityLiveRegion="polite">{error}</Text>
    </ScrollView>
  );
}
