import React, { useEffect, useState } from "react";
import { ScrollView, Text, Platform, View } from "react-native";
import { api, Button, Field, useAuth } from "@app2/core";
type Report = {
  id: string;
  reason: string;
  post_id: string | null;
  target_id: string | null;
};
type Appeal = { id: string; reason: string; user_id: string };
type Verification = {
  id: string;
  user_id: string;
  kind: string;
  organization_name: string | null;
};
type Action = {
  id: string;
  action: string;
  reason: string;
  created_at: string;
};
export default function Moderation() {
  const { session } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [takedowns, setTakedowns] = useState<{ id: string; reason: string }[]>(
    [],
  );
  const [audit, setAudit] = useState<Action[]>([]);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  async function refresh() {
    const queries = await Promise.all([
      api
        .from("reports")
        .select("*")
        .eq("status", "open")
        .order("created_at")
        .limit(50),
      api.from("appeals").select("*").eq("status", "pending").limit(50),
      api
        .from("verification_requests")
        .select("*")
        .eq("status", "pending")
        .limit(50),
      api
        .from("takedown_requests")
        .select("*")
        .eq("status", "pending")
        .limit(50),
      api
        .from("moderation_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setReports(queries[0].data || []);
    setAppeals(queries[1].data || []);
    setVerifications(queries[2].data || []);
    setTakedowns(queries[3].data || []);
    setAudit(queries[4].data || []);
    for (const q of queries) if (q.error) setStatus(q.error.message);
  }
  useEffect(() => {
    if (!session) return;
    void api.rpc("is_moderator").then(({ data }) => {
      setAuthorized(Boolean(data));
      if (data) void refresh();
    });
  }, [session]);
  async function act(r: Report, action: string) {
    if (!session || reason.trim().length < 5) {
      setStatus("Provide an audit reason");
      return;
    }
    let target = r.target_id;
    if (!target && r.post_id) {
      const { data } = await api
        .from("posts")
        .select("author_id")
        .eq("id", r.post_id)
        .single();
      target = data?.author_id || null;
    }
    const { error } = await api
      .from("moderation_actions")
      .insert({
        moderator_id: session.user.id,
        target_id: target,
        post_id: r.post_id,
        action,
        reason,
      });
    setStatus(error?.message || "Audited action applied");
    await refresh();
  }
  async function resolve(fn: string, args: Record<string, unknown>) {
    if (reason.trim().length < 5) {
      setStatus("Provide an audit reason");
      return;
    }
    const { error } = await api.rpc(fn, { ...args, explanation: reason });
    setStatus(error?.message || "Decision saved");
    await refresh();
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 28 }}>Moderator desk</Text>
      {Platform.OS !== "web" ? (
        <Text>Use the web moderator dashboard.</Text>
      ) : !authorized ? (
        <Text>
          Moderator access required. Roles are granted by the operator, never by
          a client.
        </Text>
      ) : (
        <>
          <Field label="Audit reason" value={reason} onChangeText={setReason} />
          <Text style={{ fontSize: 20 }}>Reports</Text>
          {reports.map((r) => (
            <View key={r.id}>
              <Text>{r.reason}</Text>
              {["label", "limit", "suspend", "restore"].map((a) => (
                <Button key={a} title={a} onPress={() => void act(r, a)} />
              ))}
              <Button
                title="Resolve report"
                onPress={() => void resolve("resolve_report", { report: r.id })}
              />
            </View>
          ))}
          <Text style={{ fontSize: 20 }}>Appeals</Text>
          {appeals.map((a) => (
            <View key={a.id}>
              <Text>{a.reason}</Text>
              <Button
                title="Accept appeal and restore"
                onPress={() =>
                  void resolve("resolve_appeal", {
                    appeal: a.id,
                    accepted: true,
                  })
                }
              />
              <Button
                title="Reject appeal"
                onPress={() =>
                  void resolve("resolve_appeal", {
                    appeal: a.id,
                    accepted: false,
                  })
                }
              />
            </View>
          ))}
          <Text style={{ fontSize: 20 }}>Verification requests</Text>
          {verifications.map((v) => (
            <View key={v.id}>
              <Text>
                {v.kind} · {v.organization_name || v.user_id}
              </Text>
              <Button
                title="Approve after identity review"
                onPress={() =>
                  void act(
                    {
                      id: v.id,
                      reason: "",
                      target_id: v.user_id,
                      post_id: null,
                    },
                    v.kind === "human" ? "verify_human" : "verify_organization",
                  )
                }
              />
            </View>
          ))}
          <Text style={{ fontSize: 20 }}>Takedown requests</Text>
          {takedowns.map((t) => (
            <View key={t.id}>
              <Text>{t.reason}</Text>
              <Button
                title="Accept and limit content"
                onPress={() =>
                  void resolve("resolve_takedown", {
                    request: t.id,
                    accepted: true,
                  })
                }
              />
              <Button
                title="Reject takedown"
                onPress={() =>
                  void resolve("resolve_takedown", {
                    request: t.id,
                    accepted: false,
                  })
                }
              />
            </View>
          ))}
          <Text style={{ fontSize: 20 }}>Audit log</Text>
          {audit.map((a) => (
            <Text key={a.id}>
              {a.created_at} · {a.action} · {a.reason}
            </Text>
          ))}
        </>
      )}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
