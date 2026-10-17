// Loads and decrypts the files in public/data.
import { decryptBytes, deriveSiteKeys, fromB64, normalize, openWithAnswer, toB64 } from './crypto.js';

const SAVED_KEY = 'chelseadle:key';

async function fetchBytes(name) {
  const res = await fetch(`data/${name}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Couldn't load data/${name} (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function loadMeta() {
  const res = await fetch('data/meta.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Couldn\'t load data/meta.json. Run "npm run encrypt" and try again.');
  return res.json();
}

async function openContent(key) {
  const bytes = await decryptBytes(key, await fetchBytes('content.bin'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Returns { key, content } or null if the password is wrong. */
export async function unlockWithPassword(meta, password) {
  const { key } = await deriveSiteKeys(password, meta.salt, meta.iterations);
  try {
    const content = await openContent(key);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify({ salt: meta.salt, key: toB64(key) }));
    } catch {}
    return { key, content };
  } catch {
    return null;
  }
}

/** Skips the password screen on return visits from the same device. */
export async function unlockWithSavedKey(meta) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY));
    if (!saved || saved.salt !== meta.salt) return null;
    const key = fromB64(saved.key);
    return { key, content: await openContent(key) };
  } catch {
    return null;
  }
}

const imageCache = new Map();
/** Decrypts a photo and returns an object URL for <img src>. */
export function loadImage(key, image) {
  if (!imageCache.has(image.file)) {
    imageCache.set(
      image.file,
      fetchBytes(image.file)
        .then((bytes) => decryptBytes(key, bytes))
        .then((plain) => URL.createObjectURL(new Blob([plain], { type: image.type })))
        .catch((e) => {
          imageCache.delete(image.file);
          throw e;
        }),
    );
  }
  return imageCache.get(image.file);
}

const guessCache = new Map();
/** Checks a guess against an item's locks. Resolves to the unlocked payload, or null. */
export function tryAnswer(salt, id, guess, locks) {
  const norm = normalize(guess);
  if (!norm || !locks?.length) return Promise.resolve(null);
  const cacheKey = `${id}|${norm}`;
  if (!guessCache.has(cacheKey)) {
    guessCache.set(
      cacheKey,
      (async () => {
        for (const lock of locks) {
          const payload = await openWithAnswer(salt, id, norm, lock);
          if (payload) return payload;
        }
        return null;
      })(),
    );
  }
  return guessCache.get(cacheKey);
}
