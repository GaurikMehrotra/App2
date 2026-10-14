import { creatorPayments } from "@app2/core/src/payments";
import { LocalizedText } from "@app2/core/src/LocalizedText";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, Linking } from "react-native";
import { api, Button, Field, useAuth, colors } from "@app2/core";
type Collaboration = {
  id: string;
  title: string;
  description: string;
  budget_paise: number;
};
export default function Creators() {
  const { session } = useAuth();
  const [postCount, setPostCount] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [market, setMarket] = useState<Collaboration[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creator, setCreator] = useState("");
  const [amount, setAmount] = useState("100");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (session) {
      void api
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", session.user.id)
        .then(({ count }) => setPostCount(count || 0));
      void api
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", session.user.id)
        .then(({ count }) => setFollowers(count || 0));
    }
    void api
      .from("collaborations")
      .select("*")
      .limit(30)
      .then(({ data }) => setMarket(data || []));
  }, [session]);
  async function payment(kind: "tip" | "subscribe" | "plan") {
    if (!session) return;
    const paise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(paise) || paise < 100) {
      setStatus("Enter a valid amount");
      return;
    }
    let creatorId = session.user.id;
    if (kind !== "plan") {
      const { data: profile } = await api
        .from("profiles")
        .select("id")
        .eq("handle", creator)
        .single();
      if (!profile) {
        setStatus("Creator not found");
        return;
      }
      creatorId = profile.id;
    }
    let data;
    try {
      data =
        kind === "plan"
          ? await creatorPayments.enablePlan(creatorId, paise)
          : kind === "tip"
            ? await creatorPayments.tip(creatorId, paise)
            : await creatorPayments.subscribe(creatorId);
    } catch (e) {
      setStatus(String(e));
      return;
    }
    if (data?.mode !== "test") {
      setStatus("Only test payments are allowed");
      return;
    }
    if (data.checkoutURL) {
      const url = new URL(data.checkoutURL);
      if (
        url.protocol !== "https:" ||
        !["rzp.io", "rzp.to", "razorpay.com"].some(
          (host) => url.hostname === host || url.hostname.endsWith("." + host),
        )
      ) {
        setStatus("Invalid checkout URL");
        return;
      }
      await Linking.openURL(data.checkoutURL);
    }
    setStatus(
      "Test request created. Status is confirmed only by a signed provider webhook.",
    );
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
        Creators & collaborations
      </LocalizedText>
      <LocalizedText>Test mode only. No real money is collected.</LocalizedText>
      {session && (
        <>
          <Text>
            {postCount} posts · {followers} followers
          </Text>
          <Field
            label="Creator handle"
            value={creator}
            onChangeText={setCreator}
          />
          <Field
            label="Tip amount (INR)"
            value={amount}
            onChangeText={setAmount}
          />
          <Button
            title="Create test tip order"
            onPress={() => void payment("tip")}
          />
          <Button
            title="Subscribe in test mode"
            onPress={() => void payment("subscribe")}
          />
          <Button
            title="Enable my monthly subscription plan"
            onPress={() => void payment("plan")}
          />
          <Field
            label="Collaboration title"
            value={title}
            onChangeText={setTitle}
          />
          <Field
            label="Brief"
            value={description}
            onChangeText={setDescription}
          />
          <Button
            title="Publish collaboration brief"
            onPress={() => {
              void api
                .from("collaborations")
                .insert({ brand_id: session.user.id, title, description })
                .then(({ error }) => setStatus(error?.message || "Published"));
            }}
          />
        </>
      )}
      {market.map((c) => (
        <React.Fragment key={c.id}>
          <Text style={{ fontSize: 20 }}>{c.title}</Text>
          <Text>{c.description}</Text>
        </React.Fragment>
      ))}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
