import { createClient } from "npm:@supabase/supabase-js@2.99.0";
export const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};
export function json(body: unknown, status = 200) {
  const requestId = crypto.randomUUID();
  console.info(JSON.stringify({ event: "edge_response", status, requestId }));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "X-Request-ID": requestId },
  });
}
export async function authorized(req: Request) {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return { client, user: data.user };
}
