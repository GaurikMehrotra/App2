import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { api, useAuth } from "@app2/core";
export function RequestHistory() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<
    { id: string; kind: string; status: string }[]
  >([]);
  useEffect(() => {
    if (!session) return;
    void Promise.all(
      [
        "appeals",
        "takedown_requests",
        "verification_requests",
        "privacy_requests",
      ].map(async (table) => {
        const { data } = await api
          .from(table)
          .select("id,status")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        return (data || []).map((r) => ({
          ...r,
          kind: table.replace("_requests", ""),
        }));
      }),
    ).then((results) => setRequests(results.flat()));
  }, [session]);
  return (
    <View>
      <Text style={{ fontSize: 20 }}>Request status</Text>
      {requests.map((r) => (
        <Text key={r.kind + r.id}>
          {r.kind}: {r.status}
        </Text>
      ))}
    </View>
  );
}
