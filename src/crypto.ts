/**
 * Client-side end-to-end encryption for secret chat (Web Crypto, AES-GCM-256).
 *
 * The key is generated in the browser and base64url-encoded into the URL
 * fragment (#...), which browsers never send to the server. All message text
 * and media bytes are encrypted with it before they leave the device, so the
 * server only ever handles ciphertext it cannot read.
 */

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return b64ToBytes(b64);
}

export async function generateKey(): Promise<{ key: CryptoKey; fragment: string }> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { key, fragment: b64url(raw) };
}

export async function importKeyFromFragment(fragment: string): Promise<CryptoKey> {
  const bytes = fromB64url(fragment.replace(/^#/, ""));
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return crypto.subtle.importKey("raw", ab, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Group chats: derive the AES key from a shared passphrase + the session id as
 * salt (PBKDF2). The passphrase is never sent to the server, so "join by ID +
 * passphrase" stays end-to-end encrypted. Anyone with ID + passphrase can join.
 */
export async function deriveKeyFromPassphrase(passphrase: string, saltStr: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const pwBuf = enc.encode(passphrase).slice().buffer;
  const base = await crypto.subtle.importKey("raw", pwBuf, "PBKDF2", false, ["deriveKey"]);
  const saltBuf = enc.encode(`secret-chat:${saltStr}`).slice().buffer;
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf, iterations: 250_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** A strong, reasonably-typeable random passphrase (groups of base32 chars). */
export function randomPassphrase(): string {
  const alpha = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous 0/o/1/l/i
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alpha[bytes[i]! % alpha.length];
    if (i % 5 === 4 && i < bytes.length - 1) out += "-";
  }
  return out; // e.g. "k7m2p-q9rst-vwx34"
}

// Decode base64 to a fresh ArrayBuffer (a clean BufferSource for Web Crypto).
function toBuf(b64: string): ArrayBuffer {
  const bytes = b64ToBytes(b64);
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return ab;
}
function randomIv(): { view: Uint8Array; buf: ArrayBuffer } {
  const ab = new ArrayBuffer(12);
  const view = new Uint8Array(ab);
  crypto.getRandomValues(view);
  return { view, buf: ab };
}

export async function encryptText(key: CryptoKey, text: string): Promise<{ iv: string; ct: string }> {
  const iv = randomIv();
  const ab = new TextEncoder().encode(text).slice().buffer;
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buf }, key, ab);
  return { iv: bytesToB64(iv.view), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptText(key: CryptoKey, ivB64: string, ctB64: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(ivB64) }, key, toBuf(ctB64));
  return new TextDecoder().decode(pt);
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<{ iv: string; ct: string }> {
  const iv = randomIv();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buf }, key, data);
  return { iv: bytesToB64(iv.view), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptBytes(key: CryptoKey, ivB64: string, ctB64: string): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(ivB64) }, key, toBuf(ctB64));
}
