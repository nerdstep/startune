const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function key(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = (async () => {
      const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: enc.encode("startune/v1"), info: enc.encode("github-token") },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    keyCache.set(secret, k);
  }
  return k;
}

export async function encrypt(secret: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), enc.encode(plaintext)));
  return `${b64url(iv)}.${b64url(ct)}`;
}

export async function decrypt(secret: string, payload: string): Promise<string> {
  const [iv, ct] = payload.split(".");
  if (!iv || !ct) throw new Error("Malformed ciphertext");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(iv) as BufferSource },
    await key(secret),
    fromB64url(ct) as BufferSource,
  );
  return dec.decode(pt);
}
