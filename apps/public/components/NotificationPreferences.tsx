import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { api, Button, useAuth } from "@app2/core";
import { registerPush } from "@app2/core/src/push";
const keys = [
  "replies",
  "mentions",
  "follows",
  "reposts",
  "notes",
  "dm",
] as const;
export function NotificationPreferences() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (session)
      void api
        .from("notification_settings")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSettings(data);
        });
  }, [session]);
  return (
    <View>
      {keys.map((key) => (
        <View
          key={key}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Switch
            accessibilityLabel={`${key} notifications`}
            value={settings[key] !== false}
            onValueChange={(value) => {
              if (!session) return;
              setSettings((s) => ({ ...s, [key]: value }));
              void api
                .from("notification_settings")
                .upsert({ user_id: session.user.id, [key]: value })
                .then(({ error }) =>
                  setStatus(error?.message || "Preferences saved"),
                );
            }}
          />
          <Text>{key}</Text>
        </View>
      ))}
      <Button
        title="Enable push notifications"
        onPress={() => {
          if (session)
            void registerPush(session.user.id)
              .then(() => setStatus("Registered"))
              .catch((e) => setStatus(String(e)));
        }}
      />
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </View>
  );
}
