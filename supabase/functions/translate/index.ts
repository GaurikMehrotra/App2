import {createClient} from "npm:@supabase/supabase-js@2.99.0";
import { authorized, json } from "../_shared/http.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client } = await authorized(req);
    const quota=await client.rpc("consume_provider_quota",{operation_name:"translation"});if(quota.error)return json({error:"Provider rate limit reached"},429);
    const { postId, target } = await req.json();
    if (!["en", "hi", "bn", "ta", "te", "mr"].includes(target))
      return json({ error: "Unsupported language" }, 400);
    const { data: post, error } = await client
      .from("posts")
      .select("id,body,language")
      .eq("id", postId)
      .single();
    if (error || !post) return json({ error: "Post unavailable" }, 404);
    const { data: cached } = await client
      .from("translations_cache")
      .select("body")
      .eq("post_id", postId)
      .eq("language", target)
      .maybeSingle();
    if (cached) return json({ body: cached.body });
    const endpoint = Deno.env.get("TRANSLATION_ENDPOINT");
    const token = Deno.env.get("TRANSLATION_TOKEN");
    if (!endpoint || !token)
      return json(
        { error: "Translation provider has not been configured" },
        503,
      );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: post.body, source: post.language, target }),
    });
    if (!response.ok)
      return json({ error: "Translation provider unavailable" }, 502);
    const result = await response.json();
    if (typeof result.text !== "string" || result.text.length > 5000)
      return json({ error: "Invalid provider response" }, 502);
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);await admin.from("translations_cache").upsert({post_id:postId,language:target,body:result.text,provider:new URL(endpoint).hostname});return json({ body: result.text });
  } catch {
    return json({ error: "Translation unavailable" }, 400);
  }
});
