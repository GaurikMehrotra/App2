import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Language } from "./i18n";
import { Ranking } from "./domain";
export type Preferences = {
  language: Language;
  suggested: boolean;
  ranking: Ranking;
};
const defaults: Preferences = {
  language: "en",
  suggested: false,
  ranking: "Latest",
};
const Context = createContext<{
  preferences: Preferences;
  update: (patch: Partial<Preferences>) => void;
}>({ preferences: defaults, update: () => undefined });
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(defaults);
  useEffect(() => {
    const load = async () => {
      try {
        const value =
          Platform.OS === "web"
            ? typeof localStorage !== "undefined"
              ? localStorage.getItem("app2.preferences")
              : null
            : await SecureStore.getItemAsync("app2.preferences");
        if (value) {
          const parsed = JSON.parse(value);
          setPreferences({
            language: ["en", "hi", "bn", "ta", "te", "mr"].includes(
              parsed.language,
            )
              ? parsed.language
              : "en",
            suggested: parsed.suggested === true,
            ranking: ["Latest", "Balanced", "Most helpful"].includes(
              parsed.ranking,
            )
              ? parsed.ranking
              : "Latest",
          });
        }
      } catch {
        /* Corrupt local preferences safely revert to defaults. */
      }
    };
    void load();
  }, []);
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined")
      document.documentElement.lang = preferences.language;
  }, [preferences.language]);
  function update(patch: Partial<Preferences>) {
    setPreferences((old) => {
      const next = { ...old, ...patch };
      const value = JSON.stringify(next);
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined")
          localStorage.setItem("app2.preferences", value);
      } else void SecureStore.setItemAsync("app2.preferences", value);
      return next;
    });
  }
  return (
    <Context.Provider value={{ preferences, update }}>
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
