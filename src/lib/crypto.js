// Shared encryption helpers. Runs in the browser AND in Node (scripts/build-content.mjs),
// both of which provide the standard Web Crypto API.
//
// Two layers of protection:
//  1. Everything (puzzles + photos) is AES-encrypted with a key derived from the site password.
//  2. Inside that, every answer is "locked": its reveal text is encrypted with a key derived
//     from the answer itself, so the correct answers never appear anywhere, even after login.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const PASSWORD_ITERATIONS = 250_000;
const LOCK_ITERATIONS = 20_000;

/** "Ice-Cream!" -> "icecream". Used for passwords and every answer. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomB64(length = 16) {
  return toB64(globalThis.crypto.getRandomValues(new Uint8Array(length)));
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function sha256(bytes) {
  return new Uint8Array(await subtle.digest('SHA-256', bytes));
}

export async function sha256Hex(bytes) {
  return [...(await sha256(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(secret, saltBytes, iterations, bits) {
  const base = await subtle.importKey('raw', enc.encode('k:' + secret), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(
    await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, base, bits),
  );
}

// IVs are derived from the content itself so that re-running the build on unchanged
// content produces byte-identical files (no noisy git diffs).
async function encryptWith(keyBytes, ivSeed, plain) {
  const iv = (await sha256(concat(ivSeed, plain))).slice(0, 12);
  const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return concat(iv, ct);
}

async function decryptWith(keyBytes, data) {
  const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
  return new Uint8Array(plain);
}

// ---- Layer 1: the site password ----

export async function deriveSiteKeys(password, saltB64, iterations = PASSWORD_ITERATIONS) {
  const bits = await pbkdf2(normalize(password), fromB64(saltB64), iterations, 512);
  return { key: bits.slice(0, 32), ivSeed: bits.slice(32) };
}

export function encryptBytes(keys, plain) {
  return encryptWith(keys.key, keys.ivSeed, plain);
}

/** Throws if the key is wrong. */
export function decryptBytes(key, data) {
  return decryptWith(key, data);
}

// ---- Layer 2: answer locks ----

async function lockKey(salt, id, guess) {
  return pbkdf2(normalize(guess), enc.encode(`lock|${salt}|${id}`), LOCK_ITERATIONS, 256);
}

export async function sealWithAnswer(salt, id, answer, payload) {
  const key = await lockKey(salt, id, answer);
  return toB64(await encryptWith(key, key, enc.encode(JSON.stringify(payload))));
}

/** Returns the sealed payload if `guess` is right, otherwise null. */
export async function openWithAnswer(salt, id, guess, sealedB64) {
  try {
    const key = await lockKey(salt, id, guess);
    return JSON.parse(dec.decode(await decryptWith(key, fromB64(sealedB64))));
  } catch {
    return null;
  }
}
