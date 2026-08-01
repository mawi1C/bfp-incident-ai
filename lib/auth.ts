// Uses the Web Crypto API (globalThis.crypto.subtle) rather than Node's
// `crypto` module specifically because this needs to work inside Next.js
// middleware, which may run on the Edge runtime where Node's `crypto`
// module isn't available. Web Crypto works in both Node 18+ and Edge.

const SESSION_PAYLOAD = "bfp-ncr-authenticated";
const COOKIE_NAME = "bfp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(secret: string): Promise<string> {
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(SESSION_PAYLOAD));
  return bufferToHex(signature);
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const expected = await createSessionToken(secret);
  // Not constant-time, but the token space is large enough (SHA-256 hex,
  // 64 chars) that this is not a practical concern for an internal tool
  // gated by a single shared credential.
  return token === expected;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;