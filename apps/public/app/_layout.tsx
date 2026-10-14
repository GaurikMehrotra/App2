import React from "react";
import Head from "expo-router/head";
import { PreferencesProvider } from "@app2/core/src/preferences";
import { Tabs } from "expo-router";
import { AuthProvider, colors } from "@app2/core";
export default function Layout() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <Head>
          <title>APP_NAME_2 — Public conversations</title>
        </Head>
        <Tabs
          screenOptions={{
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.ink,
            tabBarLabelStyle: { fontSize: 12 },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Conversations" }} />
          <Tabs.Screen name="people" options={{ title: "People" }} />
          <Tabs.Screen name="profile" options={{ title: "Account" }} />
          <Tabs.Screen name="controls" options={{ title: "Controls" }} />
          <Tabs.Screen
            name="messages"
            options={{ title: "Messages", href: null }}
          />
          <Tabs.Screen
            name="events"
            options={{ title: "Events", href: null }}
          />
          <Tabs.Screen
            name="moderation"
            options={{ title: "Moderation", href: null }}
          />
          <Tabs.Screen
            name="post/[id]"
            options={{ href: null, title: "Conversation" }}
          />
          <Tabs.Screen
            name="creators"
            options={{ title: "Creators", href: null }}
          />
          <Tabs.Screen
            name="search"
            options={{ title: "Search", href: null }}
          />
          <Tabs.Screen
            name="compose"
            options={{ title: "Write", href: null }}
          />
          <Tabs.Screen
            name="person/[handle]"
            options={{ href: null, title: "Profile" }}
          />
          <Tabs.Screen
            name="grievance"
            options={{ href: null, title: "Grievance" }}
          />
          <Tabs.Screen
            name="trends"
            options={{ href: null, title: "Trends" }}
          />
          <Tabs.Screen name="lists" options={{ href: null, title: "Lists" }} />
          <Tabs.Screen
            name="communities"
            options={{ href: null, title: "Communities" }}
          />
          <Tabs.Screen
            name="auth-callback"
            options={{ href: null, title: "Sign in" }}
          />
        </Tabs>
      </AuthProvider>
    </PreferencesProvider>
  );
}
