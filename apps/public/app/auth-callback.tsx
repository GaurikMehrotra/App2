import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { api } from "@app2/core";
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const [status, setStatus] = useState("Completing sign in…");
  useEffect(() => {
    if (!url) return;
    let active = true;
    const finish = async () => {
      try {
        const parsed = new URL(url);
        const params = new URLSearchParams(
          parsed.hash.slice(1) || parsed.search.slice(1),
        );
        const code = params.get("code");
        const access = params.get("access_token");
        const refresh = params.get("refresh_token");
        const result = code
          ? await api.auth.exchangeCodeForSession(code)
          : access && refresh
            ? await api.auth.setSession({
                access_token: access,
                refresh_token: refresh,
              })
            : await api.auth.getSession();
        if (result.error) throw result.error;
        if (active) {
          if (result.data.session) router.replace("/profile");
          else setStatus("Confirm your email, then sign in from Account.");
        }
      } catch {
        if (active)
          setStatus(
            "Sign in could not be completed. Return to Account and try again.",
          );
      }
    };
    void finish();
    return () => {
      active = false;
    };
  }, [url, router]);
  return (
    <View style={{ padding: 24 }}>
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </View>
  );
}
