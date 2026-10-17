import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '../components/Icons.jsx';
import { Keyboard, usePhysicalKeys } from '../components/Keyboard.jsx';
import { PuzzleLayout } from '../components/Shared.jsx';
import { statusOf } from '../lib/puzzles.js';
import { useSession } from '../lib/session.jsx';

const keyOf = (r, c) => `${r},${c}`;
const cellsOf = (e) =>
  Array.from({ length: e.length }, (_, i) => [e.row + (e.dir === 'down' ? i : 0), e.col + (e.dir === 'across' ? i : 0)]);
const other = (dir) => (dir === 'across' ? 'down' : 'across');

export default function Crossword() {
  const { content, solved, check, markSolved, puzzleData, setPuzzleData } = useSession();
  const { rows, cols, blocks, entries, sparse } = content.crossword;
  const cellRefs = useRef({});
  const letters = puzzleData('crossword').letters ?? {};
  const complete = statusOf(content, solved, 'crossword').complete;

  // Which across/down entry each square belongs to, and the clue number shown in it.
  const { cellEntries, numbers } = useMemo(() => {
    const cellEntries = {};
    const numbers = {};
    for (const e of entries) {
      numbers[keyOf(e.row, e.col)] = e.number;
      for (const [r, c] of cellsOf(e)) (cellEntries[keyOf(r, c)] ??= {})[e.dir] = e;
    }
    return { cellEntries, numbers };
  }, [entries]);

  const isBlock = (r, c) => blocks[r]?.[c] !== '.';
  const isLocked = (r, c) => Object.values(cellEntries[keyOf(r, c)] ?? {}).some((e) => solved[e.id]);

  const [sel, setSel] = useState(() => {
    const e = entries.find((x) => !solved[x.id]) ?? entries[0];
    return { r: e.row, c: e.col, dir: e.dir };
  });
  // Keep the selected square visible above the docked keyboard on tall grids.
  // Picking a clue from the list below scrolls back up to the grid.
  const firstSel = useRef(true);
  const scrollMode = useRef('nearest');
  useEffect(() => {
    if (firstSel.current) {
      firstSel.current = false;
      return;
    }
    cellRefs.current[keyOf(sel.r, sel.c)]?.scrollIntoView({ block: scrollMode.current });
    scrollMode.current = 'nearest';
  }, [sel.r, sel.c]);

  const here = cellEntries[keyOf(sel.r, sel.c)] ?? {};
  const current = here[sel.dir] ?? here[other(sel.dir)];
  const dir = current?.dir ?? sel.dir;
  const currentCells = new Set(current ? cellsOf(current).map(([r, c]) => keyOf(r, c)) : []);

  // A word turns green (and locks) as soon as it's right.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const e of entries) {
        if (solved[e.id]) continue;
        const word = cellsOf(e)
          .map(([r, c]) => letters[keyOf(r, c)] ?? '')
          .join('');
        if (word.length !== e.length) continue;
        const payload = await check(e.id, word, e.locks);
        if (cancelled) return;
        if (payload) markSolved(e.id, { answer: payload.answer });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, solved]);

  // Finishing scrolls back up to the "Solved!" banner.
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) window.scrollTo({ top: 0, behavior: 'smooth' });
    wasComplete.current = complete;
  }, [complete]);

  const allFilled = entries.every((e) => cellsOf(e).every(([r, c]) => letters[keyOf(r, c)]));

  function setLetter(r, c, ch) {
    setPuzzleData('crossword', (d) => {
      d.letters ??= {};
      if (ch) d.letters[keyOf(r, c)] = ch;
      else delete d.letters[keyOf(r, c)];
    });
  }

  function selectEntry(e) {
    const cells = cellsOf(e);
    const target =
      cells.find(([r, c]) => !letters[keyOf(r, c)] && !isLocked(r, c)) ??
      cells.find(([r, c]) => !isLocked(r, c)) ??
      cells[0];
    setSel({ r: target[0], c: target[1], dir: e.dir });
  }

  function stepEntry(delta) {
    if (!current) return;
    const unsolved = entries.filter((e) => !solved[e.id] || e === current);
    const list = unsolved.length > 1 ? unsolved : entries;
    const i = list.indexOf(current);
    selectEntry(list[(i + delta + list.length) % list.length]);
  }

  function tapCell(r, c) {
    if (isBlock(r, c)) return;
    const cell = cellEntries[keyOf(r, c)] ?? {};
    if (r === sel.r && c === sel.c) {
      if (cell[other(dir)]) setSel({ r, c, dir: other(dir) });
      return;
    }
    setSel({ r, c, dir: cell[dir] ? dir : other(dir) });
  }

  function typeLetter(ch) {
    if (!current || complete) return;
    if (!isLocked(sel.r, sel.c)) setLetter(sel.r, sel.c, ch);
    // Like the NYT Mini: skip squares that are already filled in.
    const filledNow = { ...letters, [keyOf(sel.r, sel.c)]: ch };
    const open = ([r, c]) => !filledNow[keyOf(r, c)] && !isLocked(r, c);
    const cells = cellsOf(current);
    const idx = cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
    const gapInWord = cells.slice(idx + 1).find(open) ?? cells.slice(0, idx).find(open);
    if (gapInWord) {
      setSel({ r: gapInWord[0], c: gapInWord[1], dir });
      return;
    }
    // Word is full: jump to the next word that still has gaps...
    const start = entries.indexOf(current);
    for (let step = 1; step < entries.length; step++) {
      const e = entries[(start + step) % entries.length];
      if (solved[e.id]) continue;
      const gap = cellsOf(e).find(open);
      if (gap) {
        setSel({ r: gap[0], c: gap[1], dir: e.dir });
        return;
      }
    }
    // ...or, if the whole grid is full, just step forward so she can fix letters.
    const next = cells.slice(idx + 1).find(([r, c]) => !isLocked(r, c));
    if (next) setSel({ r: next[0], c: next[1], dir });
  }

  function backspace() {
    if (!current || complete) return;
    if (letters[keyOf(sel.r, sel.c)] && !isLocked(sel.r, sel.c)) {
      setLetter(sel.r, sel.c, '');
      return;
    }
    const cells = cellsOf(current);
    const idx = cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
    const prev = cells
      .slice(0, idx)
      .reverse()
      .find(([r, c]) => !isLocked(r, c));
    if (prev) {
      setLetter(prev[0], prev[1], '');
      setSel({ r: prev[0], c: prev[1], dir });
    }
  }

  function move(dr, dc) {
    let r = sel.r + dr;
    let c = sel.c + dc;
    while (r >= 0 && c >= 0 && r < rows && c < cols && isBlock(r, c)) {
      r += dr;
      c += dc;
    }
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    const want = dr ? 'down' : 'across';
    const cell = cellEntries[keyOf(r, c)] ?? {};
    setSel({ r, c, dir: cell[want] ? want : other(want) });
  }

  usePhysicalKeys((e) => {
    if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toUpperCase());
    else if (e.key === 'Backspace' || e.key === 'Delete') backspace();
    else if (e.key === 'ArrowLeft') move(0, -1);
    else if (e.key === 'ArrowRight') move(0, 1);
    else if (e.key === 'ArrowUp') move(-1, 0);
    else if (e.key === 'ArrowDown') move(1, 0);
    else if (e.key === 'Tab' || e.key === 'Enter') stepEntry(e.shiftKey ? -1 : 1);
    else if (e.key === ' ') {
      if (here[other(dir)]) setSel({ ...sel, dir: other(dir) });
    } else return;
    e.preventDefault();
  });

  return (
    <PuzzleLayout puzzleKey="crossword">
      <div className="cw">
        <div
          className={`cw-grid${sparse ? ' is-sparse' : ''}`}
          style={{ '--cols': cols }}
          role="grid"
          aria-label="Crossword grid"
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const k = keyOf(r, c);
              if (isBlock(r, c)) return <div key={k} className="cw-cell is-block" aria-hidden="true" />;
              const classes = ['cw-cell'];
              if (isLocked(r, c)) classes.push('is-solved');
              if (!complete && currentCells.has(k)) classes.push('in-word');
              if (!complete && r === sel.r && c === sel.c) classes.push('is-selected');
              return (
                <div
                  key={k}
                  ref={(el) => (cellRefs.current[k] = el)}
                  className={classes.join(' ')}
                  role="gridcell"
                  onClick={() => tapCell(r, c)}
                >
                  {numbers[k] && <span className="cw-num">{numbers[k]}</span>}
                  <span className="cw-letter">{letters[k] ?? ''}</span>
                </div>
              );
            }),
          )}
        </div>

        {!complete && (
          <div className="cw-dock">
            {allFilled && (
              <p className="feedback cw-feedback" role="status">
                Every square is filled, but some words aren&rsquo;t right yet. Correct words turn green.
              </p>
            )}
            {current && (
              <div className="cw-cluebar">
                <button type="button" className="icon-btn" onClick={() => stepEntry(-1)} aria-label="Previous clue">
                  <ChevronLeft width="22" height="22" />
                </button>
                <button
                  type="button"
                  className="cw-clue-text"
                  onClick={() => here[other(dir)] && setSel({ ...sel, dir: other(dir) })}
                  aria-live="polite"
                >
                  <b>
                    {current.number}
                    {current.dir === 'across' ? 'A' : 'D'}
                  </b>{' '}
                  {current.clue}
                </button>
                <button type="button" className="icon-btn" onClick={() => stepEntry(1)} aria-label="Next clue">
                  <ChevronRight width="22" height="22" />
                </button>
              </div>
            )}
            <Keyboard onLetter={typeLetter} onBackspace={backspace} />
          </div>
        )}

        <div className="cw-clues">
          {['across', 'down'].map((d) => (
            <section key={d}>
              <h2>{d === 'across' ? 'Across' : 'Down'}</h2>
              <ol>
                {entries
                  .filter((e) => e.dir === d)
                  .map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={`cw-clue${e === current && !complete ? ' is-current' : ''}${solved[e.id] ? ' is-solved' : ''}`}
                        onClick={() => {
                          scrollMode.current = 'center';
                          selectEntry(e);
                        }}
                      >
                        <b>{e.number}</b>
                        <span>{e.clue}</span>
                      </button>
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </PuzzleLayout>
  );
}
