import { authorized, json } from "../_shared/http.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client, user } = await authorized(req);
    const { kind, confirmation } = await req.json();
    if (kind === "export") {
      const bindings: Record<string, string> = {
        profiles: "id",
        posts: "author_id",
        follows: "follower_id",
        likes: "user_id",
        bookmarks: "user_id",
        mutes: "owner_id",
        blocks: "owner_id",
        reports: "reporter_id",
        appeals: "user_id",
        notes: "author_id",
        messages: "sender_id",
        notifications: "user_id",
        consents: "user_id",
      };
      const data: Record<string, unknown> = {
        account: { id: user.id, email: user.email },
      };
      for (const [table, column] of Object.entries(bindings)) {
        const result = await client
          .from(table)
          .select("*")
          .eq(column, user.id)
          .limit(10000);
        if (result.error) throw result.error;
        data[table] = result.data;
      }
      return json({
        exportedAt: new Date().toISOString(),
        data,
        limitPerTable: 10000,
      });
    }
    if (kind === "delete") {
      if (confirmation !== "DELETE MY ACCOUNT")
        return json({ error: "Explicit deletion confirmation required" }, 400);
      const queued = await client
        .from("privacy_requests")
        .insert({ user_id: user.id, kind: "delete" });
      if (queued.error) throw queued.error;
      return json({
        status: "pending",
        message:
          "Deletion requires retention review and media cleanup before identity removal.",
      });
    }
    return json({ error: "Unsupported request" }, 400);
  } catch {
    return json({ error: "Privacy request failed" }, 400);
  }
});
