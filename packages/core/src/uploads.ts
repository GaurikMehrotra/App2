import { api } from "./index";
import { mediaLimits } from "./domain";
export type Attachment = {
  uri: string;
  kind: "image" | "video" | "voice";
  contentType: string;
  seconds?: number;
};
export async function uploadAttachment(
  postId: string,
  userId: string,
  file: Attachment,
) {
  const response = await fetch(file.uri);
  const bytes = await response.arrayBuffer();
  const max =
    file.kind === "image"
      ? mediaLimits.imageBytes
      : file.kind === "voice"
        ? mediaLimits.voiceBytes
        : mediaLimits.videoBytes;
  if (bytes.byteLength > max) throw new Error("Attachment exceeds size limit");
  if ((file.seconds || 0) > (file.kind === "video" ? 60 : 120))
    throw new Error("Attachment exceeds duration limit");
  const path = `${userId}/${postId}/${Date.now()}`;
  const { error } = await api.storage
    .from("app2-quarantine")
    .upload(path, bytes, { contentType: file.contentType, upsert: false });
  if (error) throw error;
  const row = await api.from("post_media").insert({
    post_id: postId,
    path,
    kind: file.kind,
    bytes: bytes.byteLength,
    duration_seconds: Math.ceil(file.seconds || 0),
  });
  if (row.error) throw row.error;
  return path;
}
