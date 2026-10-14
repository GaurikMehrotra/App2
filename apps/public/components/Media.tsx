import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAudioPlayer } from "expo-audio";
import { api, Button } from "@app2/core";
function Video({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: 240 }}
      nativeControls
    />
  );
}
function Voice({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  return (
    <Button
      title="Play / pause voice post"
      onPress={() => (player.playing ? player.pause() : player.play())}
    />
  );
}
export function Media({ postId }: { postId: string }) {
  const [files, setFiles] = useState<
    { id: string; kind: string; url: string }[]
  >([]);
  useEffect(() => {
    let active = true;
    void api
      .from("post_media")
      .select("*")
      .eq("post_id", postId)
      .eq("scan_status", "safe")
      .then(async ({ data }) => {
        const resolved = await Promise.all(
          (data || []).map(async (m) => {
            const { data } = await api.storage
              .from("app2-media")
              .createSignedUrl(m.path, 300);
            return { id: m.id, kind: m.kind, url: data?.signedUrl || "" };
          }),
        );
        if (active) setFiles(resolved.filter((f) => f.url));
      });
    return () => {
      active = false;
    };
  }, [postId]);
  return (
    <View>
      {files.map((f) => (
        <View key={f.id}>
          {f.kind === "image" ? (
            <Image
              source={{ uri: f.url }}
              accessibilityLabel="Post attachment"
              style={{ width: "100%", height: 240, resizeMode: "contain" }}
            />
          ) : f.kind === "video" ? (
            <Video url={f.url} />
          ) : f.kind === "voice" ? (
            <Voice url={f.url} />
          ) : (
            <Text>Unsupported media</Text>
          )}
        </View>
      ))}
    </View>
  );
}
