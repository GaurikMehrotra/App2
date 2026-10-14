import React, { useEffect, useState } from "react";
import { ScrollView, Text, Linking } from "react-native";
import { api, Button, Field, useAuth, colors } from "@app2/core";
import { creatorPayments } from "@app2/core/src/payments";
type Community = {
  id: string;
  name: string;
  price_paise: number;
  creator_id: string;
};
export default function Communities() {
  const { session } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("100");
  const [status, setStatus] = useState("");
  async function load() {
    const { data, error } = await api
      .from("paid_communities")
      .select("*")
      .limit(50);
    setCommunities(data || []);
    if (error) setStatus(error.message);
  }
  useEffect(() => {
    void load();
  }, []);
  async function create() {
    if (!session) return;
    const amount = Math.round(Number(price) * 100);
    if (!name.trim() || !Number.isFinite(amount) || amount < 100) {
      setStatus("Provide a name and monthly amount");
      return;
    }
    const { data: chat, error } = await api
      .from("conversations")
      .insert({ owner_id: session.user.id, name, kind: "room" })
      .select("id")
      .single();
    if (error) {
      setStatus(error.message);
      return;
    }
    const member = await api
      .from("conversation_members")
      .insert({
        conversation_id: chat.id,
        user_id: session.user.id,
        accepted: true,
      });
    if (member.error) {
      setStatus(member.error.message);
      return;
    }
    const result = await api
      .from("paid_communities")
      .insert({
        creator_id: session.user.id,
        conversation_id: chat.id,
        name,
        price_paise: amount,
      });
    setStatus(
      result.error?.message ||
        "Test community created. Enable a matching creator plan in Creators.",
    );
    await load();
  }
  async function subscribe(c: Community) {
    try {
      const data = await creatorPayments.subscribe(c.creator_id);
      if (data.checkoutURL) {
        const url = new URL(data.checkoutURL);
        if (
          url.protocol !== "https:" ||
          !["rzp.io", "rzp.to", "razorpay.com"].some(
            (host) =>
              url.hostname === host || url.hostname.endsWith("." + host),
          )
        )
          throw new Error("Invalid checkout URL");
        await Linking.openURL(data.checkoutURL);
      }
      setStatus("Complete test checkout; a signed callback activates access.");
    } catch (e) {
      setStatus(String(e));
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
      <Text style={{ fontSize: 28 }}>Paid communities · test mode</Text>
      {session && (
        <>
          <Field label="Community name" value={name} onChangeText={setName} />
          <Field
            label="Monthly price (INR)"
            value={price}
            onChangeText={setPrice}
          />
          <Button title="Create test community" onPress={() => void create()} />
        </>
      )}
      {communities.map((c) => (
        <React.Fragment key={c.id}>
          <Text>
            {c.name} · INR {c.price_paise / 100}/month
          </Text>
          <Button
            title="Subscribe in test mode"
            onPress={() => void subscribe(c)}
          />
          <Button
            title="Join with active test subscription"
            onPress={() => {
              void api
                .rpc("join_paid_community", { community: c.id })
                .then(({ error }) =>
                  setStatus(
                    error?.message ||
                      "Joined. Open Messages to enter the room.",
                  ),
                );
            }}
          />
        </React.Fragment>
      ))}
      <Text accessibilityLiveRegion="polite">{status}</Text>
    </ScrollView>
  );
}
