import { usePostLimit } from "@app2/core/src/usePostLimit";
import { usePreferences } from "@app2/core/src/preferences";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, Platform } from "react-native";
import * as Picker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { api, Button, Field, useAuth, colors } from "@app2/core";
import { Attachment, uploadAttachment } from "@app2/core/src/uploads";
import { validatePost } from "@app2/core/src/domain";
export default function Compose() {
  const { session } = useAuth();
  const postLimit = usePostLimit();
  const { preferences } = usePreferences();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [poll, setPoll] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recording = useAudioRecorderState(recorder);
  useEffect(() => {
    if (recording.isRecording && recording.durationMillis >= 120000)
      void recorder.stop().then(() => {
        if (recorder.uri)
          setAttachment({
            uri: recorder.uri,
            kind: "voice",
            contentType: Platform.OS === "web" ? "audio/webm" : "audio/mp4",
            seconds: 120,
          });
      });
  }, [recording.durationMillis, recording.isRecording, recorder]);
  async function pick(video: boolean) {
    try {
      const permission = await Picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus("Media permission is required");
        return;
      }
      const result = await Picker.launchImageLibraryAsync({
        mediaTypes: video ? ["videos"] : ["images"],
        quality: 0.75,
        videoMaxDuration: 60,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (video) {
        if ((file.duration || 0) > 60000)
          throw new Error("Video must be at most 60 seconds");
        setAttachment({
          uri: file.uri,
          kind: "video",
          contentType: file.mimeType || "video/mp4",
          seconds: (file.duration || 0) / 1000,
        });
      } else {
        const compressed = await manipulateAsync(
          file.uri,
          [{ resize: { width: Math.min(file.width, 1600) } }],
          { compress: 0.75, format: SaveFormat.JPEG },
        );
        setAttachment({
          uri: compressed.uri,
          kind: "image",
          contentType: "image/jpeg",
        });
      }
      setStatus(
        "Attachment selected. It will remain quarantined until scanned.",
      );
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function record() {
    try {
      if (recording.isRecording) {
        const seconds = recording.durationMillis / 1000;
        await recorder.stop();
        if (recorder.uri)
          setAttachment({
            uri: recorder.uri,
            kind: "voice",
            contentType: Platform.OS === "web" ? "audio/webm" : "audio/mp4",
            seconds,
          });
        return;
      }
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) {
        setStatus("Microphone permission is required");
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function publish() {
    if (!session) {
      setStatus("Sign in first");
      return;
    }
    setBusy(true);
    try {
      const text = validatePost(body, postLimit);
      const choices = poll
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
      if (choices.length && choices.length < 2)
        throw new Error("A poll needs at least two options");
      if (choices.length > 4)
        throw new Error("A poll supports at most four options");
      const { data, error } = await api
        .from("posts")
        .insert({
          author_id: session.user.id,
          body: text,
          language: preferences.language,
        })
        .select("id")
        .single();
      if (error || !data) throw error || new Error("Post failed");
      if (attachment)
        await uploadAttachment(data.id, session.user.id, attachment);
      if (choices.length) {
        const { data: p, error: e } = await api
          .from("polls")
          .insert({
            post_id: data.id,
            ends_at: new Date(Date.now() + 86400000).toISOString(),
          })
          .select("id")
          .single();
        if (e || !p) throw e || new Error("Poll failed");
        const result = await api
          .from("poll_options")
          .insert(choices.map((label) => ({ poll_id: p.id, label })));
        if (result.error) throw result.error;
      }
      setBody("");
      setAttachment(null);
      setPoll("");
      setStatus("Published. Media is pending a trusted scan.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
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
        Write, show, or speak
      </LocalizedText>
      <Field
        label={`Post (${postLimit} characters)`}
        value={body}
        onChangeText={setBody}
        multiline
      />
      <Button title="Attach image" onPress={() => void pick(false)} />
      <Button title="Attach short video" onPress={() => void pick(true)} />
      <Button
        title={recording.isRecording ? "Stop voice recording" : "Record voice"}
        onPress={() => void record()}
      />
      <Text>
        {Math.floor(recording.durationMillis / 1000)} seconds ·{" "}
        {attachment?.kind || "No attachment"}
      </Text>
      <Field
        label="Poll options (one per line, optional)"
        value={poll}
        onChangeText={setPoll}
        multiline
      />
      <Button
        title="Publish"
        onPress={() => void publish()}
        disabled={busy || recording.isRecording}
      />
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
