export async function verifyProviderSignature(
  bytes: Uint8Array<ArrayBuffer>,
  signature: string,
  secret: string,
) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sig = Uint8Array.from(signature.match(/.{2}/g)!, (v) =>
    parseInt(v, 16),
  );
  return crypto.subtle.verify("HMAC", key, sig, bytes);
}
