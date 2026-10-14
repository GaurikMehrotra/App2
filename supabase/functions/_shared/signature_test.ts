import { verifyProviderSignature } from "./signature.ts";
Deno.test(
  "provider signature authenticates exact raw bytes and rejects tampering",
  async () => {
    const secret = "fixture-only-signature-key";
    const bytes = new TextEncoder().encode('{"event":"payment_link.paid"}');
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Array.from(
      new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes)),
      (v) => v.toString(16).padStart(2, "0"),
    ).join("");
    if (!(await verifyProviderSignature(bytes, signature, secret)))
      throw new Error("Valid signature rejected");
    if (
      await verifyProviderSignature(
        new TextEncoder().encode("tampered"),
        signature,
        secret,
      )
    )
      throw new Error("Tampered payload accepted");
    if (await verifyProviderSignature(bytes, signature, "wrong-fixture-key"))
      throw new Error("Wrong secret accepted");
    if (await verifyProviderSignature(bytes, "invalid", secret))
      throw new Error("Malformed signature accepted");
  },
);
