const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 2; // 2 days
export const AUTH_COOKIE_NAME = "tts_auth";

interface TokenPayload {
  sub: string;
  exp: number;
}

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it in .env (at least 16 characters)."
    );
  }
  return secret;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(message: Uint8Array): Promise<Uint8Array> {
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) as ArrayBuffer
  );
  return new Uint8Array(sig);
}

export async function createToken(username: string): Promise<string> {
  const payload: TokenPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const sig = await hmacSign(payloadBytes);
  return `${bytesToBase64url(payloadBytes)}.${bytesToBase64url(sig)}`;
}

export async function verifyToken(
  token: string | undefined | null
): Promise<TokenPayload | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = base64urlToBytes(payloadB64);
    sigBytes = base64urlToBytes(sigB64);
  } catch {
    return null;
  }

  let expectedSig: Uint8Array;
  try {
    expectedSig = await hmacSign(payloadBytes);
  } catch {
    return null;
  }
  if (!constantTimeEqual(sigBytes, expectedSig)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(bytesToString(payloadBytes)) as TokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return payload;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  return constantTimeEqual(aBytes, bBytes);
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.AUTH_USERNAME || "";
  const expectedPass = process.env.AUTH_PASSWORD || "";
  if (!expectedUser || !expectedPass) return false;
  return (
    constantTimeStringEqual(username, expectedUser) &&
    constantTimeStringEqual(password, expectedPass)
  );
}
