import { usePreferences } from "./preferences";
import { phrase } from "./phrases";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import "react-native-url-polyfill/auto";
import { createClient, Session } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
const storage = {
  getItem: async (k: string) =>
    Platform.OS === "web"
      ? typeof localStorage !== "undefined"
        ? localStorage.getItem(k)
        : null
      : SecureStore.getItemAsync(k),
  setItem: async (k: string, v: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
    } else await SecureStore.setItemAsync(k, v);
  },
  removeItem: async (k: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.removeItem(k);
    } else await SecureStore.deleteItemAsync(k);
  },
};
export const api = createClient(
  url || "https://unconfigured.supabase.co",
  key || "unconfigured",
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);
const Auth = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = api.auth.onAuthStateChange((_event, s) => setSession(s));
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") api.auth.startAutoRefresh();
      else api.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  return <Auth.Provider value={{ session, loading }}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);
export const colors = { ink: "#193a36", paper: "#f6f4eb", accent: "#216c5d" };
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { preferences } = usePreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? "#60736f" : colors.accent,
        padding: 14,
        borderRadius: 12,
        marginVertical: 5,
      }}
    >
      <Text style={{ color: "white", fontWeight: "600" }}>
        {phrase(preferences.language, title)}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  const { preferences } = usePreferences();
  const localizedLabel = phrase(preferences.language, label);
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={{ color: colors.ink, marginBottom: 5 }}>{label}</Text>
      <TextInput
        accessibilityLabel={localizedLabel}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#78908a",
          borderRadius: 8,
          padding: 12,
          color: colors.ink,
          backgroundColor: "white",
        }}
      />
    </View>
  );
}
export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  verified_student: boolean;
  verified_human: boolean;
};
