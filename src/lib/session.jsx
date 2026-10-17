// Everything a puzzle needs after login: decrypted content, saved progress, and a
// way to check answers.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tryAnswer } from './data.js';

const SessionContext = createContext(null);

const emptyProgress = () => ({ solved: {}, data: {}, stamped: {} });

function storageKey(meta) {
  return `chelseadle:progress:${meta.salt}`;
}

export function loadProgress(meta) {
  try {
    const p = JSON.parse(localStorage.getItem(storageKey(meta)));
    if (p && typeof p === 'object') return { ...emptyProgress(), ...p };
  } catch {}
  return emptyProgress();
}

/** Drops saved "solved" entries that no longer match the current puzzles (e.g. after you edit an answer). */
export async function verifyProgress(meta, content, progress) {
  const locks = {};
  for (const e of content.crossword.entries) locks[e.id] = e.locks;
  for (const k of ['cryptic', 'photos', 'trivia']) for (const it of content[k].items) locks[it.id] = it.locks;
  const solved = {};
  await Promise.all(
    Object.entries(progress.solved).map(async ([id, entry]) => {
      if (!locks[id] || !entry?.answer) return;
      if (await tryAnswer(meta.salt, id, entry.answer, locks[id])) solved[id] = entry;
    }),
  );
  return { ...progress, solved };
}

export function SessionProvider({ meta, content, imageKey, initialProgress, children }) {
  const [progress, setProgress] = useState(initialProgress);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(meta), JSON.stringify(progress));
    } catch {}
  }, [meta, progress]);

  /** update(draft => { draft.data.x = 1 }) */
  const update = useCallback((fn) => {
    setProgress((p) => {
      const draft = structuredClone(p);
      fn(draft);
      return draft;
    });
  }, []);

  const value = useMemo(
    () => ({
      meta,
      content,
      imageKey,
      progress,
      solved: progress.solved,
      update,
      check: (id, guess, locks) => tryAnswer(meta.salt, id, guess, locks),
      markSolved: (id, entry) => update((d) => void (d.solved[id] = entry)),
      puzzleData: (key) => progress.data[key] ?? {},
      setPuzzleData: (key, fn) =>
        update((d) => {
          d.data[key] ??= {};
          fn(d.data[key]);
        }),
      reset: () => setProgress(emptyProgress()),
    }),
    [meta, content, imageKey, progress, update],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
