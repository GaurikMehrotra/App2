import { TopicSelector } from "../components/TopicSelector";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { api, Button, Field, useAuth, configured, colors } from "@app2/core";
export default function Account() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [links, setLinks] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (session)
      api
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()
        .then(({ data, error }) => {
          if (error) setStatus(error.message);
          if (data) {
            setName(data.display_name);
            setHandle(data.handle);
            setBio(data.bio);
            setCity(data.city);
            setLinks((data.links || []).join("\n"));
          }
        });
  }, [session]);
  async function auth(signup: boolean) {
    if (!configured) {
      setStatus("Configure Supabase to use accounts.");
      return;
    }
    const result = signup
      ? await api.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: Linking.createURL("/auth-callback") },
        })
      : await api.auth.signInWithPassword({ email, password });
    setStatus(
      result.error?.message ||
        (signup ? "Check your email to confirm your account." : "Signed in."),
    );
  }
  async function save() {
    if (!session) return;
    const { error } = await api
      .from("profiles")
      .update({
        display_name: name,
        handle,
        bio,
        city,
        links: links
          .split("\n")
          .map((url) => url.trim())
          .filter((url) => /^https:\/\//.test(url)),
      })
      .eq("id", session.user.id);
    setStatus(error?.message || "Profile saved.");
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
        maxWidth: 800,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Text style={{ fontSize: 28, color: colors.ink }}>
        Your public identity
      </Text>
      {session ? (
        <>
          <Field label="Display name" value={name} onChangeText={setName} />
          <Field label="Handle" value={handle} onChangeText={setHandle} />
          <Field label="Bio" value={bio} onChangeText={setBio} multiline />
          <Field
            label="City (adult accounts only)"
            value={city}
            onChangeText={setCity}
          />
          <Field
            label="Links (HTTPS, one per line)"
            value={links}
            onChangeText={setLinks}
            multiline
          />
          <Field
            label="Age confirmation: birth date (YYYY-MM-DD)"
            value={birthDate}
            onChangeText={setBirthDate}
          />
          <Button
            title="Confirm age"
            onPress={() => {
              void api
                .from("user_safety")
                .insert({ user_id: session.user.id, birth_date: birthDate })
                .then(({ error }) =>
                  setStatus(
                    error?.message ||
                      "Age saved. Minors require reviewed guardian consent before posting.",
                  ),
                );
            }}
          />
          <TopicSelector />
          <Button title="Save profile" onPress={() => void save()} />
          <Button title="Sign out" onPress={() => void api.auth.signOut()} />
        </>
      ) : (
        <>
          <LocalizedText>
            One account for public and campus conversations.
          </LocalizedText>
          <Field label="Email" value={email} onChangeText={setEmail} />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button title="Sign in" onPress={() => void auth(false)} />
          <Button title="Create account" onPress={() => void auth(true)} />
        </>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
