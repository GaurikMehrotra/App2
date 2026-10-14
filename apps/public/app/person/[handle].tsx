import { LocalizedText } from "@app2/core/src/LocalizedText";
import React, { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { api, Button, useAuth, Profile, colors } from "@app2/core";
type PublicProfile = Profile & { links: string[]; pinned_post: string | null };
export default function Person() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<{ id: string; body: string }[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    void api
      .from("profiles")
      .select("*")
      .eq("handle", handle)
      .single()
      .then(async ({ data, error }) => {
        if (error) {
          setStatus(error.message);
          return;
        }
        setProfile(data);
        const results = await Promise.all([
          api
            .from("posts")
            .select("id,body")
            .eq("author_id", data.id)
            .order("created_at", { ascending: false })
            .limit(25),
          api
            .from("follows")
            .select("profiles!follows_follower_id_fkey(handle)")
            .eq("followee_id", data.id)
            .limit(50),
          api
            .from("follows")
            .select("profiles!follows_followee_id_fkey(handle)")
            .eq("follower_id", data.id)
            .limit(50),
        ]);
        setPosts(results[0].data || []);
        setFollowers(
          (results[1].data || []).map(
            (r) => (r.profiles as unknown as { handle: string })?.handle,
          ),
        );
        setFollowing(
          (results[2].data || []).map(
            (r) => (r.profiles as unknown as { handle: string })?.handle,
          ),
        );
      });
  }, [handle]);
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28 }}>
        {profile?.display_name} @{handle}
      </Text>
      {profile?.verified_student && (
        <LocalizedText>Verified student</LocalizedText>
      )}
      {profile?.verified_human && <LocalizedText>Verified human</LocalizedText>}
      <Text>{profile?.bio}</Text>
      {profile?.links
        ?.filter((url) => /^https:\/\//.test(url))
        .map((url) => (
          <Link key={url} href={url}>
            {url}
          </Link>
        ))}
      <Text>Followers: {followers.join(", ") || "None"}</Text>
      <Text>Following: {following.join(", ") || "None"}</Text>
      {posts.map((p) => (
        <React.Fragment key={p.id}>
          {profile?.pinned_post === p.id && (
            <LocalizedText>Pinned</LocalizedText>
          )}
          <Link href={{ pathname: "/post/[id]", params: { id: p.id } }}>
            {p.body}
          </Link>
          {session?.user.id === profile?.id && (
            <Button
              title="Pin post"
              onPress={() => {
                void api
                  .from("profiles")
                  .update({ pinned_post: p.id })
                  .eq("id", profile!.id)
                  .then(({ error }) => setStatus(error?.message || "Pinned"));
              }}
            />
          )}
        </React.Fragment>
      ))}
      <Text>{status}</Text>
    </ScrollView>
  );
}
