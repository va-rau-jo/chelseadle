import { normalize } from './crypto.js';

export const PUZZLES = [
  { key: 'crossword', color: 'var(--crossword)', tint: 'var(--crossword-tint)' },
  { key: 'cryptic', color: 'var(--cryptic)', tint: 'var(--cryptic-tint)' },
  { key: 'photos', color: 'var(--photos)', tint: 'var(--photos-tint)' },
  { key: 'trivia', color: 'var(--trivia)', tint: 'var(--trivia-tint)' },
];

export function itemsOf(content, key) {
  return key === 'crossword' ? content.crossword.entries : content[key].items;
}

export function statusOf(content, solved, key) {
  const items = itemsOf(content, key);
  const done = items.filter((it) => solved[it.id]).length;
  return { total: items.length, done, complete: items.length > 0 && done === items.length };
}

/** The combined answers that unlock a puzzle's completion message. */
export function groupGuess(content, solved, key) {
  return itemsOf(content, key)
    .map((it) => normalize(solved[it.id]?.answer))
    .join('');
}
