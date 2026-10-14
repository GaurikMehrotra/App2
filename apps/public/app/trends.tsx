import React, { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { api, Button, Field, colors } from "@app2/core";
import { usePreferences } from "@app2/core/src/preferences";
export default function Trends() {
  const { preferences } = usePreferences();
  const [region, setRegion] = useState("");
const [category,setCategory]=useState("");
  const [trends, setTrends] = useState<{ tag: string; score: number }[]>([]);
  const [status, setStatus] = useState("");
  async function load() {
    const { data, error } = await api.rpc("regional_trends", {
      region,
      lang: preferences.language,category_name:category,
    });
    setTrends(data || []);
    setStatus(error?.message || "");
  }
  useEffect(() => {
    void load();
  }, [preferences.language]);
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: colors.paper,
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28 }}>Regional trends</Text>
      <Text>
        Unique accounts contribute once per tag. New accounts contribute less.
      </Text>
      <Field
        label="City or state (blank for all regions)"
        value={region}
        onChangeText={setRegion}
      />
      <Field label="Category (learning, sport, technology, culture)" value={category} onChangeText={setCategory}/><Button title="Refresh trends" onPress={() => void load()} />
      {trends.map((t) => (
        <Text key={t.tag} style={{ padding: 12, fontSize: 20 }}>
          #{t.tag}
        </Text>
      ))}
      <Text>{status}</Text>
    </ScrollView>
  );
}
