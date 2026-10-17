// Turns your private content/puzzles.json (+ content/photos) into encrypted files in
// public/data. Only public/data is committed, so the public repo never contains answers.
//
// Runs automatically with `npm run dev` and `npm run build`. Run by hand with `npm run encrypt`.

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PASSWORD_ITERATIONS,
  deriveSiteKeys,
  encryptBytes,
  normalize,
  randomB64,
  sealWithAnswer,
  sha256Hex,
} from '../src/lib/crypto.js';

const PUZZLE_KEYS = ['crossword', 'cryptic', 'photos', 'trivia'];
const IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export async function buildContent({ root = process.cwd(), log = console.log } = {}) {
  const contentDir = path.join(root, 'content');
  const outDir = path.join(root, 'public', 'data');
  const srcFile = path.join(contentDir, 'puzzles.json');

  if (!existsSync(srcFile)) {
    if (existsSync(path.join(outDir, 'content.bin'))) {
      log('[chelseadle] No content/puzzles.json found, using the encrypted files already in public/data.');
      return { skipped: true };
    }
    throw new Error('Missing content/puzzles.json. Copy the content.example folder to content/ to get started.');
  }

  let src;
  try {
    src = JSON.parse(await readFile(srcFile, 'utf8'));
  } catch (e) {
    throw new Error(`content/puzzles.json is not valid JSON: ${e.message}`);
  }

  const problems = [];
  const warnings = [];
  const problem = (msg) => problems.push(msg);

  if (!src.password || typeof src.password !== 'string' || !normalize(src.password)) {
    problem('"password" is missing (it needs at least one letter or number).');
  }
  for (const key of PUZZLE_KEYS) {
    if (!src[key]) problem(`The "${key}" section is missing.`);
  }
  if (problems.length) throw new Error(formatProblems(problems));

  // Reuse the salt from the last build so unchanged content gives identical files.
  let salt;
  try {
    salt = JSON.parse(await readFile(path.join(outDir, 'meta.json'), 'utf8')).salt;
  } catch {}
  salt ||= randomB64(16);

  const siteKeys = await deriveSiteKeys(src.password, salt);
  const files = new Map(); // filename -> bytes
  const canonical = {}; // puzzle -> normalized answers in order (for completion messages)

  const seal = (id, answer, payload) => sealWithAnswer(salt, id, answer, payload);

  // ---------- Crossword ----------
  const cwSrc = src.crossword;
  // Letters are answers; '.', '#' or a space mark empty squares.
  const grid = (Array.isArray(cwSrc.grid) ? cwSrc.grid : []).map((r) => String(r).toUpperCase().replace(/[.\s]/g, '#'));
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows) problem('crossword.grid needs at least one row.');
  grid.forEach((row, r) => {
    if (row.length !== cols) problem(`crossword.grid row ${r + 1} is ${row.length} wide, but row 1 is ${cols}.`);
    if (!/^[A-Z#]*$/.test(row)) problem(`crossword.grid row ${r + 1} ("${row}") can only contain letters A-Z, plus . or # for empty squares.`);
  });
  const isBlock = (r, c) => r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] === '#' || grid[r][c] === undefined;
  const entries = [];
  const used = { across: new Set(), down: new Set() };
  let number = 1;
  const starts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isBlock(r, c)) continue;
      const across = isBlock(r, c - 1) && !isBlock(r, c + 1);
      const down = isBlock(r - 1, c) && !isBlock(r + 1, c);
      if (across || down) {
        starts.push({ r, c, n: number, across, down });
        number++;
      }
    }
  }
  for (const dir of ['across', 'down']) {
    for (const s of starts) {
      if (!s[dir]) continue;
      let word = '';
      for (let i = 0; ; i++) {
        const r = s.r + (dir === 'down' ? i : 0);
        const c = s.c + (dir === 'across' ? i : 0);
        if (isBlock(r, c)) break;
        word += grid[r][c];
      }
      const clue = cwSrc[dir]?.[String(s.n)];
      if (!clue) problem(`crossword.${dir} is missing a clue for ${s.n} (${word}).`);
      used[dir].add(String(s.n));
      entries.push({ number: s.n, dir, row: s.r, col: s.c, length: word.length, clue: clue ?? '', word });
    }
  }
  for (const dir of ['across', 'down']) {
    for (const n of Object.keys(cwSrc[dir] ?? {})) {
      if (!used[dir].has(n)) problem(`crossword.${dir} has a clue for ${n}, but no ${dir} word starts at square ${n}.`);
    }
  }
  const crossword = {
    title: cwSrc.title || 'Crossword',
    intro: cwSrc.intro || '',
    rows,
    cols,
    blocks: grid.map((row) => row.replace(/[A-Z]/g, '.')),
    // Mostly-empty grids are drawn freeform (no black squares).
    sparse: grid.join('').replace(/[A-Z]/g, '').length > grid.join('').length * 0.3,
    entries: [],
  };
  for (const e of entries) {
    const id = `crossword.${e.number}${e.dir === 'across' ? 'A' : 'D'}`;
    const { word, ...rest } = e;
    crossword.entries.push({ id, ...rest, locks: [await seal(id, word, { answer: word })] });
  }
  canonical.crossword = entries.map((e) => normalize(e.word));

  // ---------- Shared item helpers ----------
  function answersOf(item, where) {
    const list = item.answers ?? (item.answer != null ? [item.answer] : []);
    const arr = (Array.isArray(list) ? list : [list]).map(String);
    if (!arr.length || arr.some((a) => !normalize(a))) {
      problem(`${where} needs an "answer" (or a list of "answers") with letters or numbers in it.`);
      return [];
    }
    const seen = new Set();
    return arr.filter((a) => !seen.has(normalize(a)) && seen.add(normalize(a)));
  }
  const hintsOf = (item) => (item.hints ?? (item.hint ? [item.hint] : [])).map(String);
  const itemsOf = (key, field = 'items') => {
    const list = src[key][field];
    if (!Array.isArray(list) || !list.length) {
      problem(`${key}.${field} needs at least one entry.`);
      return [];
    }
    return list;
  };
  const idFor = (key, item, i) => `${key}.${item.id ?? i + 1}`;

  // ---------- Minute cryptic ----------
  const cryptic = { title: src.cryptic.title || 'Minute Cryptic', intro: src.cryptic.intro || '', items: [] };
  canonical.cryptic = [];
  for (const [i, item] of itemsOf('cryptic', 'clues').entries()) {
    const where = `cryptic clue ${i + 1}`;
    const id = idFor('cryptic', item, i);
    const answers = answersOf(item, where);
    if (!answers.length) continue;
    const main = answers[0];
    if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(main.trim())) {
      problem(`${where}: the answer "${main}" should only use letters, spaces, hyphens or apostrophes.`);
      continue;
    }
    // "Ice-cream cake" -> groups [{len:3,sep:'-'},{len:5,sep:' '},{len:4,sep:''}]
    const parts = main.trim().replace(/'/g, '').split(/([\s-]+)/);
    const groups = [];
    for (let p = 0; p < parts.length; p += 2) {
      const sep = parts[p + 1] ? (parts[p + 1].includes('-') ? '-' : ' ') : '';
      groups.push({ len: parts[p].length, sep });
    }
    const definition = item.definition ? String(item.definition) : null;
    if (definition && !String(item.clue).toLowerCase().includes(definition.toLowerCase())) {
      problem(`${where}: the definition "${definition}" doesn't appear in the clue text.`);
    }
    if (!item.clue) problem(`${where} is missing its "clue".`);
    const payload = { answer: main, note: item.explanation ?? null };
    cryptic.items.push({
      id,
      clue: String(item.clue ?? ''),
      definition,
      hints: hintsOf(item),
      groups,
      length: groups.reduce((n, g) => n + g.len, 0),
      locks: await Promise.all(answers.map((a) => seal(id, a, payload))),
    });
    canonical.cryptic.push(normalize(main));
  }

  // ---------- Photos ----------
  const photos = { title: src.photos.title || 'Photo Guess', intro: src.photos.intro || '', items: [] };
  canonical.photos = [];
  for (const [i, item] of itemsOf('photos').entries()) {
    const where = `photo ${i + 1}`;
    const id = idFor('photos', item, i);
    const answers = answersOf(item, where);
    if (!item.image) {
      problem(`${where} is missing "image" (a file name inside content/photos).`);
      continue;
    }
    const candidates = [path.join(contentDir, 'photos', item.image), path.join(contentDir, item.image)];
    const imgPath = candidates.find((p) => existsSync(p));
    const type = IMAGE_TYPES[path.extname(String(item.image)).toLowerCase()];
    if (!imgPath) {
      problem(`${where}: can't find content/photos/${item.image}.`);
      continue;
    }
    if (!type) {
      problem(`${where}: ${item.image} must be a .jpg, .png, .webp, .gif or .avif (iPhone .heic photos need converting).`);
      continue;
    }
    if (!answers.length) continue;
    const bytes = new Uint8Array(await readFile(imgPath));
    if (bytes.length > 2_000_000) {
      warnings.push(`${item.image} is ${(bytes.length / 1e6).toFixed(1)} MB. Shrinking it to about 1600px wide will make it load much faster on her phone.`);
    }
    const encrypted = await encryptBytes(siteKeys, bytes);
    const file = `img-${(await sha256Hex(encrypted)).slice(0, 16)}.bin`;
    files.set(file, encrypted);
    photos.items.push({
      id,
      image: { file, type },
      question: String(item.question ?? ''),
      hints: hintsOf(item),
      locks: await Promise.all(answers.map((a) => seal(id, a, { answer: answers[0], note: item.reveal ?? null }))),
    });
    canonical.photos.push(normalize(answers[0]));
  }

  // ---------- Trivia ----------
  const trivia = { title: src.trivia.title || 'Trivia', intro: src.trivia.intro || '', items: [] };
  canonical.trivia = [];
  for (const [i, item] of itemsOf('trivia').entries()) {
    const where = `trivia question ${i + 1}`;
    const id = idFor('trivia', item, i);
    const answers = answersOf(item, where);
    if (!answers.length) continue;
    let choices = null;
    if (item.choices) {
      choices = item.choices.map(String);
      const right = choices.filter((c) => answers.some((a) => normalize(a) === normalize(c)));
      if (!right.length) problem(`${where}: the answer "${answers[0]}" isn't one of its choices.`);
    }
    trivia.items.push({
      id,
      question: String(item.question ?? ''),
      choices,
      hints: hintsOf(item),
      locks: await Promise.all(answers.map((a) => seal(id, a, { answer: answers[0], note: item.reveal ?? null }))),
    });
    canonical.trivia.push(normalize(answers[0]));
  }

  if (problems.length) throw new Error(formatProblems(problems));

  // Messages that unlock only when a whole puzzle (or everything) is solved.
  const sections = { crossword, cryptic, photos, trivia };
  for (const key of PUZZLE_KEYS) {
    const msg = src[key].completeMessage;
    if (msg) {
      sections[key].completeLock = await seal(`${key}.complete`, canonical[key].join(''), { message: String(msg) });
    }
  }
  let finaleLock = null;
  if (src.finale?.message) {
    const all = PUZZLE_KEYS.map((k) => canonical[k].join('')).join('');
    finaleLock = await seal('finale', all, {
      title: String(src.finale.title ?? 'Happy birthday!'),
      message: String(src.finale.message),
    });
  }

  const content = {
    title: src.title || 'Chelseadle',
    subtitle: src.subtitle || '',
    ...sections,
    finaleLock,
  };
  files.set('content.bin', await encryptBytes(siteKeys, new TextEncoder().encode(JSON.stringify(content))));

  const meta = {
    title: content.title,
    passwordHint: src.passwordHint || '',
    salt,
    iterations: PASSWORD_ITERATIONS,
  };
  files.set('meta.json', new TextEncoder().encode(JSON.stringify(meta, null, 2) + '\n'));

  // Write only what changed, and remove photos that are no longer used.
  await mkdir(outDir, { recursive: true });
  let changed = 0;
  for (const [name, bytes] of files) {
    const target = path.join(outDir, name);
    const old = existsSync(target) ? new Uint8Array(await readFile(target)) : null;
    if (!old || Buffer.compare(Buffer.from(old), Buffer.from(bytes)) !== 0) {
      await writeFile(target, bytes);
      changed++;
    }
  }
  for (const name of await readdir(outDir)) {
    if (/^(img-[0-9a-f]+\.bin|content\.bin|meta\.json)$/.test(name) && !files.has(name)) {
      await unlink(path.join(outDir, name));
      changed++;
    }
  }

  for (const w of warnings) log(`[chelseadle] Heads up: ${w}`);
  if (normalize(src.password) === 'birthday') {
    log('[chelseadle] Heads up: you are still using the example password "birthday". Change it in content/puzzles.json.');
  }
  log(
    `[chelseadle] Encrypted ${crossword.entries.length} crossword words, ${cryptic.items.length} cryptic clues, ` +
      `${photos.items.length} photos and ${trivia.items.length} trivia questions` +
      (changed ? ` (${changed} file${changed === 1 ? '' : 's'} updated in public/data).` : ' (no changes).'),
  );
  return { skipped: false, changed };
}

function formatProblems(list) {
  return `content/puzzles.json needs a few fixes:\n${list.map((p) => `  - ${p}`).join('\n')}`;
}

// Allow `node scripts/build-content.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildContent().catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  });
}
