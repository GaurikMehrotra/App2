import { createClient } from "npm:@supabase/supabase-js@2.99.0";
import { authorized, json } from "../_shared/http.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client } = await authorized(req);
    const { data: moderator } = await client.rpc("is_moderator");
    if (!moderator) return json({ error: "Moderator access required" }, 403);
    const endpoint = Deno.env.get("MEDIA_PROCESSOR_ENDPOINT");
    const token = Deno.env.get("MEDIA_PROCESSOR_TOKEN");
    const outputHost = Deno.env.get("MEDIA_PROCESSOR_OUTPUT_HOST");
    if (!endpoint || !token || !outputHost)
      return json(
        { error: "Trusted scanning/compression provider is not configured" },
        503,
      );
    const { mediaId } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: media, error } = await admin
      .from("post_media")
      .select("*")
      .eq("id", mediaId)
      .eq("scan_status", "pending")
      .single();
    if (error || !media) return json({ error: "Pending media not found" }, 404);
    const signed = await admin.storage
      .from("app2-quarantine")
      .createSignedUrl(media.path, 120);
    if (signed.error) throw signed.error;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        source: signed.data.signedUrl,
        kind: media.kind,
        maxSeconds: media.kind === "video" ? 60 : 120,
        maxBytes:
          media.kind === "image"
            ? 10485760
            : media.kind === "voice"
              ? 5242880
              : 26214400,
      }),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const verdict = await response.json();
    if (verdict.safe !== true) {
      await admin
        .from("post_media")
        .update({ scan_status: "rejected" })
        .eq("id", media.id);
      return json({ status: "rejected" });
    }
    const output = new URL(verdict.processedURL);
    if (output.protocol !== "https:" || output.hostname !== outputHost)
      throw new Error("Invalid provider output");
    const download = await fetch(output, { redirect: "error" });
    if (!download.ok) throw new Error("Processed media unavailable");
    const max =
      media.kind === "image"
        ? 10485760
        : media.kind === "voice"
          ? 5242880
          : 26214400;
    const advertised = Number(download.headers.get("content-length"));
    if (!advertised || advertised > max) throw new Error("Invalid media size");
    const bytes = await download.arrayBuffer();
    if (bytes.byteLength > max) throw new Error("Media too large");
    const duration = Number(verdict.durationSeconds || 0);
    if (
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > (media.kind === "video" ? 60 : 120)
    )
      throw new Error("Invalid duration");
    const contentType = String(verdict.contentType);
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "audio/mp4",
        "audio/mpeg",
        "audio/webm",
      ].includes(contentType)
    )
      throw new Error("Invalid media type");
    const uploaded = await admin.storage
      .from("app2-media")
      .upload(media.path, bytes, { contentType, upsert: true });
    if (uploaded.error) throw uploaded.error;
    const saved = await admin
      .from("post_media")
      .update({
        scan_status: "safe",
        bytes: bytes.byteLength,
        duration_seconds: duration,
      })
      .eq("id", media.id);
    if (saved.error) throw saved.error;
    await admin.storage.from("app2-quarantine").remove([media.path]);
    return json({ status: "safe" });
  } catch {
    return json(
      { error: "Media processing failed; file remains quarantined" },
      400,
    );
  }
});
