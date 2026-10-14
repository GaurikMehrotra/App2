import { createClient } from "npm:@supabase/supabase-js@2.99.0";
import { authorized, json } from "../_shared/http.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client, user } = await authorized(req);
    const quota=await client.rpc("consume_provider_quota",{operation_name:"payment"});if(quota.error)return json({error:"Provider rate limit reached"},429);
    const key = Deno.env.get("RAZORPAY_KEY_ID");
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!key?.startsWith("rzp_test_") || !secret)
      return json({ error: "Test-mode Razorpay is not configured" }, 503);
    const { creatorId, amountPaise, kind = "tip" } = await req.json();
    if (
      !["tip", "subscribe", "plan"].includes(kind) ||
      typeof creatorId !== "string"
    )
      return json({ error: "Invalid request" }, 400);
    const creator = await client
      .from("profiles")
      .select("id")
      .eq("id", creatorId)
      .single();
    if (creator.error) return json({ error: "Creator unavailable" }, 404);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${key}:${secret}`),
    };
    if (kind === "subscribe") {
      const { data: plan, error } = await client
        .from("subscription_plans")
        .select("*")
        .eq("creator_id", creatorId)
        .eq("test_mode", true)
        .single();
      if (error)
        return json({ error: "Creator has not enabled subscriptions" }, 400);
      const response = await fetch(
        "https://api.razorpay.com/v1/subscriptions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            plan_id: plan.provider_plan_id,
            total_count: 12,
            customer_notify: 1,
            notes: { subscriberId: user.id, creatorId },
          }),
        },
      );
      if (!response.ok) throw new Error("Provider unavailable");
      const subscription = await response.json();
      const saved = await admin
        .from("subscriptions")
        .insert({
          subscriber_id: user.id,
          creator_id: creatorId,
          provider_ref: subscription.id,
          test_mode: true,
        });
      if (saved.error) throw saved.error;
      return json({
        id: subscription.id,
        checkoutURL: subscription.short_url,
        mode: "test",
      });
    }
    if (
      !Number.isInteger(amountPaise) ||
      amountPaise < 100 ||
      amountPaise > 100000
    )
      return json({ error: "Amount must be INR 1–1000" }, 400);
    if (kind === "plan") {
      if (creatorId !== user.id)
        return json({ error: "Create only your own plan" }, 403);
      const response = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers,
        body: JSON.stringify({
          period: "monthly",
          interval: 1,
          item: {
            name: "APP_NAME_2 creator subscription",
            amount: amountPaise,
            currency: "INR",
          },
        }),
      });
      if (!response.ok) throw new Error("Provider unavailable");
      const plan = await response.json();
      const result = await admin
        .from("subscription_plans")
        .insert({
          creator_id: user.id,
          provider_plan_id: plan.id,
          amount_paise: amountPaise,
        });
      if (result.error) throw result.error;
      return json({ id: plan.id, mode: "test" });
    }
    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        description: "APP_NAME_2 test creator tip",
        accept_partial: false,
        notes: { creatorId, payerId: user.id },
      }),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const link = await response.json();
    const result = await admin
      .from("tips")
      .insert({
        payer_id: user.id,
        creator_id: creatorId,
        amount_paise: amountPaise,
        provider_ref: link.id,
        test_mode: true,
      });
    if (result.error) throw result.error;
    return json({ id: link.id, checkoutURL: link.short_url, mode: "test" });
  } catch {
    return json({ error: "Test payment request failed" }, 400);
  }
});
