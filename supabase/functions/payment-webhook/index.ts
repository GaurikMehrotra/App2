import { verifyProviderSignature } from "../_shared/signature.ts";
import { createClient } from "npm:@supabase/supabase-js@2.99.0";
import { json } from "../_shared/http.ts";
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret || !Deno.env.get("RAZORPAY_KEY_ID")?.startsWith("rzp_test_"))
    return json({ error: "Test provider disabled" }, 503);
  const bytes = new Uint8Array(await req.arrayBuffer());
  const signature = req.headers.get("x-razorpay-signature") || "";
  if (!/^[0-9a-f]{64}$/i.test(signature))
    return json({ error: "Invalid signature" }, 401);
  if (!(await verifyProviderSignature(bytes, signature, secret)))
    return json({ error: "Invalid signature" }, 401);
  try {
    const event = JSON.parse(new TextDecoder().decode(bytes));
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const eventId = req.headers.get("x-razorpay-event-id");
    if (!eventId || eventId.length > 200)
      return json({ error: "Event ID required" }, 400);
    const prior = await admin
      .from("payment_events")
      .select("applied")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (prior.error) throw prior.error;
    if (prior.data?.applied) return json({ status: "already applied" });
    if (!prior.data) {
      const inserted = await admin
        .from("payment_events")
        .insert({ provider_event_id: eventId, event_type: event.event });
      if (inserted.error && inserted.error.code !== "23505")
        throw inserted.error;
    }
    const applied = async () => {
      const result = await admin
        .from("payment_events")
        .update({ applied: true })
        .eq("provider_event_id", eventId);
      if (result.error) throw result.error;
    };
    if (event.event === "payment_link.paid") {
      const link = event.payload?.payment_link?.entity;
      if (
        !link?.id ||
        link.currency !== "INR" ||
        link.status !== "paid" ||
        link.amount_paid !== link.amount
      )
        return json({ error: "Invalid paid link" }, 400);
      const { data, error } = await admin
        .from("tips")
        .select("id,amount_paise")
        .eq("provider_ref", link.id)
        .eq("test_mode", true)
        .single();
      if (error || data.amount_paise !== link.amount)
        return json({ error: "Unmatched payment" }, 400);
      const result = await admin
        .from("tips")
        .update({ status: "paid" })
        .eq("id", data.id)
        .eq("status", "pending");
      if (result.error) throw result.error;
      await applied();
      return json({ status: "accepted" });
    }
    if (
      [
        "subscription.charged",
        "subscription.cancelled",
        "subscription.completed",
      ].includes(event.event)
    ) {
      const subscription = event.payload?.subscription?.entity;
      if (!subscription?.id)
        return json({ error: "Invalid subscription" }, 400);
      if (!Number.isSafeInteger(event.created_at) || event.created_at <= 0)
        return json({ error: "Event timestamp required" }, 400);
      const { error } = await admin
        .from("subscriptions")
        .update({
          status:
            event.event === "subscription.charged" ? "active" : "cancelled",
        })
        .eq("provider_ref", subscription.id)
        .eq("test_mode", true)
        .lt("provider_event_at", event.created_at);
      if (error) throw error;
      await applied();
      return json({ status: "accepted" });
    }
    return json({ status: "ignored" });
  } catch {
    return json({ error: "Payment event failed" }, 400);
  }
});
