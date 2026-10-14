import { LocalizedText } from "@app2/core/src/LocalizedText";
import React, { useState } from "react";
import { ScrollView, Text, Linking } from "react-native";
import { api, Button, Field, useAuth, colors } from "@app2/core";
export default function Grievance() {
  const { session } = useAuth();
  const [postId, setPostId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const name = process.env.EXPO_PUBLIC_GRIEVANCE_NAME;
  const email = process.env.EXPO_PUBLIC_GRIEVANCE_EMAIL;
  async function submit() {
    if (!session) {
      setStatus(
        "Sign in to track a request, or contact the grievance officer by email.",
      );
      return;
    }
    if (reason.trim().length < 10) {
      setStatus("Describe the request and relevant grounds.");
      return;
    }
    const { error } = await api
      .from("takedown_requests")
      .insert({ user_id: session.user.id, post_id: postId || null, reason });
    setStatus(error?.message || "Request submitted for operator review.");
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
        Grievance & takedown requests
      </LocalizedText>
      <Text>
        {name || "Grievance officer details await operator configuration."}
      </Text>
      {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
        <Button
          title={`Contact ${email}`}
          onPress={() => void Linking.openURL("mailto:" + email)}
        />
      )}
      <LocalizedText>
        Submit the relevant content, grounds, and supporting context. Requests
        are private. You may appeal moderation through Controls.
      </LocalizedText>
      <Field
        label="Post ID (optional)"
        value={postId}
        onChangeText={setPostId}
      />
      <Field
        label="Request details"
        value={reason}
        onChangeText={setReason}
        multiline
      />
      <Button title="Submit takedown request" onPress={() => void submit()} />
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
