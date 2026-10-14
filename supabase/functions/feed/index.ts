import { authorized, json } from "../_shared/http.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client } = await authorized(req);
    const { style = "Latest", language = "en", cursor } = await req.json();
    if (
      !["Latest", "Balanced", "Most helpful"].includes(style) ||
      !["en", "hi", "bn", "ta", "te", "mr"].includes(language)
    )
      return json({ error: "Invalid feed options" }, 400);
    const { data, error } = await client.rpc("get_feed", {
      mode: "Suggested",
      style,
      lang: language,
      before_time: cursor?.time || null,
      before_id: cursor?.id || null,
      before_score: cursor?.score ?? null,
    });
    if (error) throw error;
    return json({ posts: data });
  } catch {
    return json({ error: "Feed unavailable" }, 400);
  }
});
