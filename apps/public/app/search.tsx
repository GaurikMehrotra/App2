import { searchEngine, SearchResult } from "@app2/core/src/search";
import { usePreferences } from "@app2/core/src/preferences";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import React, { useState } from "react";
import { ScrollView, Text } from "react-native";
import { Link } from "expo-router";
import { Button, Field, colors } from "@app2/core";
export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("");
  const { preferences } = usePreferences();
  async function search() {
    if (!query.trim()) return;
    try {
      setResults(await searchEngine.search(query, preferences.language));
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Search failed");
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
        Search the public square
      </LocalizedText>
      <Field
        label="People, posts, hashtags, topics"
        value={query}
        onChangeText={setQuery}
      />
      <Button title="Search" onPress={() => void search()} />
      {results.map((r) => (
        <React.Fragment key={r.kind + r.id}>
          {r.kind === "post" ? (
            <Link href={{ pathname: "/post/[id]", params: { id: r.id } }}>
              {r.label}
            </Link>
          ) : (
            <Text style={{ padding: 12 }}>
              {r.kind}: {r.label}
            </Text>
          )}
        </React.Fragment>
      ))}
      <Text>{status}</Text>
    </ScrollView>
  );
}
