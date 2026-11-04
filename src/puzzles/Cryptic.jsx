import { useEffect, useRef, useState } from 'react';
import { Keyboard, usePhysicalKeys } from '../components/Keyboard.jsx';
import { ItemNav, PuzzleLayout, SolvedNote, usePosition } from '../components/Shared.jsx';
import { normalize, unmaskLetters } from '../lib/crypto.js';
import { useSession } from '../lib/session.jsx';

// Minute Cryptic-style hints. Each one highlights part of the clue in its own colour.
const HINT_TYPES = [
  { key: 'indicator', label: 'show indicators' },
  { key: 'fodder', label: 'show fodder' },
  { key: 'definition', label: 'show definition' },
];

export default function Cryptic() {
  const { content } = useSession();
  const items = content.cryptic.items;
  const { pos, setPos, nextUnsolved } = usePosition('cryptic', items);
  return (
    <PuzzleLayout puzzleKey="cryptic">
      <ItemNav items={items} pos={pos} setPos={setPos} noun="Clue" />
      <Clue key={items[pos].id} item={items[pos]} nextUnsolved={nextUnsolved} setPos={setPos} />
    </PuzzleLayout>
  );
}

function Clue({ item, nextUnsolved, setPos }) {
  const { meta, solved, check, markSolved, puzzleData, setPuzzleData } = useSession();
  const N = item.length;
  const saved = puzzleData('cryptic')[item.id] ?? {};
  const letters = toArray(saved.letters, N);
  const revealed = saved.revealed ?? [];
  const shown = saved.shown ?? {};
  // Scratchpad tiles: { ch, x, y } in pixels inside the pad (x/y null = not placed yet).
  const scratch = (saved.scratch ?? []).map((t, i) =>
    typeof t === 'string' ? { id: `old${i}`, ch: t, x: null, y: null } : t,
  );
  const entry = solved[item.id];

  const available = HINT_TYPES.filter((t) => item.highlights?.[t.key]?.length);
  const totalDots = N + available.length;
  const used = available.filter((t) => shown[t.key]).length + revealed.length;

  const isLocked = (i) => !!entry || revealed.includes(i);
  const firstOpen = () => {
    const i = letters.findIndex((l, j) => !l && !isLocked(j));
    return i >= 0 ? i : 0;
  };
  const [cursor, setCursor] = useState(firstOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(scratch.length > 0);
  const [status, setStatus] = useState('idle'); // idle | checking | wrong

  const save = (fn) =>
    setPuzzleData('cryptic', (d) => {
      d[item.id] ??= {};
      fn(d[item.id]);
    });

  // ---------- Typing into the answer ----------
  function typeAnswer(ch) {
    if (entry) return;
    let i = cursor;
    while (i < N && isLocked(i)) i++;
    if (i >= N) return;
    const next = [...letters];
    next[i] = ch;
    save((d) => void (d.letters = next));
    let j = i + 1;
    while (j < N && isLocked(j)) j++;
    setCursor(j < N ? j : i);
    setStatus('idle');
  }

  function backspaceAnswer() {
    if (entry) return;
    const next = [...letters];
    if (next[cursor] && !isLocked(cursor)) {
      next[cursor] = '';
    } else {
      let j = cursor - 1;
      while (j >= 0 && isLocked(j)) j--;
      if (j < 0) return;
      next[j] = '';
      setCursor(j);
    }
    save((d) => void (d.letters = next));
    setStatus('idle');
  }

  // ---------- Scratchpad ----------
  const typeScratch = (ch) =>
    scratch.length < 24 && save((d) => void (d.scratch = [...scratch, { id: `${Date.now()}${Math.random()}`, ch, x: null, y: null }]));
  const backspaceScratch = () => save((d) => void (d.scratch = scratch.slice(0, -1)));

  const onLetter = (ch) => (scratchOpen ? typeScratch(ch) : typeAnswer(ch));
  const onBackspace = () => (scratchOpen ? backspaceScratch() : backspaceAnswer());

  // ---------- Checking ----------
  const full = letters.every(Boolean);
  async function submit() {
    if (entry || !full || status === 'checking') return;
    setStatus('checking');
    const payload = await check(item.id, letters.join(''), item.locks);
    if (payload) {
      markSolved(item.id, { answer: payload.answer, note: payload.note, hints: used });
      setStatus('idle');
      setMenuOpen(false);
      setScratchOpen(false);
    } else setStatus('wrong');
  }

  // ---------- Hints ----------
  function showHint(key) {
    save((d) => {
      d.shown ??= {};
      d.shown[key] = true;
    });
    setMenuOpen(false);
  }

  async function showLetter() {
    const word = await unmaskLetters(meta.salt, item.id, item.letters);
    const i = [...Array(N).keys()].find((j) => !revealed.includes(j));
    if (i == null) return;
    save((d) => {
      d.revealed = [...revealed, i];
      d.letters = letters.map((l, j) => (j === i ? word[i] : l));
    });
    if (cursor === i) {
      let j = i + 1;
      while (j < N && revealed.includes(j)) j++;
      if (j < N) setCursor(j);
    }
    setStatus('idle');
    setMenuOpen(false);
  }

  usePhysicalKeys((e) => {
    if (/^[a-zA-Z]$/.test(e.key)) onLetter(e.key.toUpperCase());
    else if (e.key === 'Backspace') onBackspace();
    else if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') setMenuOpen(false);
    else if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
    else if (e.key === 'ArrowRight') setCursor((c) => Math.min(N - 1, c + 1));
    else return;
    e.preventDefault();
  }, !entry);

  // ---------- Letter boxes, grouped by word ----------
  const display = entry ? normalize(entry.answer).toUpperCase() : null;
  let index = 0;
  const groups = item.groups.map((g, gi) => (
    <span key={gi} className="box-group">
      {Array.from({ length: g.len }, () => {
        const i = index++;
        const cls = ['box'];
        if (entry) cls.push('is-solved');
        else {
          if (i === cursor && !scratchOpen) cls.push('is-cursor');
          if (revealed.includes(i)) cls.push('is-revealed');
        }
        return (
          <button
            type="button"
            key={i}
            className={cls.join(' ')}
            onClick={() => {
              setCursor(i);
              setScratchOpen(false);
            }}
            disabled={!!entry}
            aria-label={`Letter ${i + 1}${letters[i] ? `: ${letters[i]}` : ', empty'}`}
          >
            {display ? display[i] : letters[i]}
          </button>
        );
      })}
      {g.sep === '-' && (
        <span className="box-hyphen" aria-hidden="true">
          -
        </span>
      )}
    </span>
  ));
  const enumeration = item.groups.map((g) => g.len + (g.sep === '-' ? '-' : g.sep ? ',' : '')).join('');

  const showAll = !!entry;
  const marks = {};
  for (const t of available) if (showAll || shown[t.key]) marks[t.key] = item.highlights[t.key];

  return (
    <div className="cryptic">
      <div className="clue-card">
        <p className="cryptic-clue">
          <ClueText text={item.clue} marks={marks} /> <span className="enum">({enumeration})</span>
        </p>
      </div>

      {item.indicatorNote && (shown.indicator || entry) && (
        <p className="indicator-note" role="note">
          <span className="hl hl-indicator">Indicator</span> {item.indicatorNote}
        </p>
      )}

      <div className={`boxes${status === 'wrong' ? ' is-wrong' : ''}`} role="group" aria-label="Your answer">
        {groups}
      </div>

      <HintDots total={totalDots} used={entry ? entry.hints ?? used : used} par={item.par} />

      {entry ? (
        <>
          <SolvedNote entry={entry} onNext={nextUnsolved() >= 0 ? () => setPos(nextUnsolved()) : null} />
          <p className="meta-line">
            {parLine(entry.hints ?? used, item.par)}
          </p>
        </>
      ) : (
        <>
          <div className="cryptic-actions">
            <button
              type="button"
              className={`scribble-btn${scratchOpen ? ' is-on' : ''}`}
              onClick={() => setScratchOpen((o) => !o)}
              aria-pressed={scratchOpen}
              aria-label="Scratchpad for rearranging letters"
            >
              <ScribbleIcon />
            </button>
            <button type="button" className="cc-pill cc-pill-hints" onClick={() => setMenuOpen(true)}>
              hints
            </button>
            <button type="button" className="cc-pill cc-pill-check" onClick={submit} disabled={!full || status === 'checking'}>
              check
            </button>
          </div>

          <p className="feedback" role="status">
            {status === 'wrong' ? 'Not quite. Change some letters and check again.' : ' '}
          </p>

          {scratchOpen && (
            <Scratchpad
              tiles={scratch}
              onChange={(tiles) => save((d) => void (d.scratch = tiles))}
              onClose={() => setScratchOpen(false)}
            />
          )}

          <Keyboard onLetter={onLetter} onBackspace={onBackspace} />

          {menuOpen && (
            <HintMenu
              types={available}
              shown={shown}
              lettersLeft={N - revealed.length}
              onPick={showHint}
              onLetter={showLetter}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function parLine(hints, par) {
  const used = hints === 0 ? 'no hints' : `${hints} hint${hints === 1 ? '' : 's'}`;
  if (par == null) return `Solved with ${used}.`;
  const diff = hints - (par + 1);
  const vs = diff === 0 ? 'right on par' : diff < 0 ? `${-diff} under par` : `${diff} over par`;
  return `Solved with ${used}, ${vs}.`;
}

/** One dot per available hint; filled dots are hints used. */
function HintDots({ total, used, par }) {
  return (
    <div className="hint-dots" aria-label={`${used} of ${total} hints used${par != null ? `, par is ${par + 1}` : ''}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`hint-dot${i < used ? ' is-used' : ''}${i === par ? ' is-par' : ''}`}>
          {i === par && <span className="par-label">par</span>}
        </span>
      ))}
    </div>
  );
}

function HintMenu({ types, shown, lettersLeft, onPick, onLetter, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('button:not(:disabled)')?.focus();
  }, []);
  return (
    <>
      <div className="hint-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="hint-menu" role="dialog" aria-label="Select a hint" ref={ref}>
        <div className="hint-menu-head">
          <span>Select a hint</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close hints">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {types.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`hint-option hl-${t.key}`}
            onClick={() => onPick(t.key)}
            disabled={!!shown[t.key]}
          >
            <span>{t.label}</span>
            {shown[t.key] && <small>shown</small>}
          </button>
        ))}
        <hr />
        <button type="button" className="hint-option hl-letter" onClick={onLetter} disabled={lettersLeft === 0}>
          <span>show letter</span>
          {lettersLeft === 0 && <small>all shown</small>}
        </button>
      </div>
    </>
  );
}

/** Letters she can drag anywhere on the pad to try anagrams. */
const TILE_W = 40;
const TILE_H = 44;
const GAP = 6;

function Scratchpad({ tiles, onChange, onClose }) {
  const pad = useRef(null);
  const section = useRef(null);
  const [live, setLive] = useState(null); // tile positions while dragging

  // Opening the pad scrolls it into view above the on-screen keyboard.
  useEffect(() => {
    const kb = document.querySelector('.kb');
    if (!section.current || !kb) return;
    const overlap = section.current.getBoundingClientRect().bottom - kb.getBoundingClientRect().top + 8;
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
  }, []);
  const dragRef = useRef(null);
  const shown = live ?? tiles;

  const size = () => {
    const r = pad.current?.getBoundingClientRect();
    return { w: r?.width ?? 320, h: r?.height ?? 150 };
  };

  // Tidy row-by-row slots, used for newly typed letters and Shuffle.
  const slot = (i, w) => {
    const perRow = Math.max(1, Math.floor((w - GAP) / (TILE_W + GAP)));
    return { x: GAP + (i % perRow) * (TILE_W + GAP), y: GAP + Math.floor(i / perRow) * (TILE_H + GAP) };
  };

  // Give newly typed letters the first slot that's free.
  useEffect(() => {
    if (!tiles.some((t) => t.x == null)) return;
    const { w } = size();
    const placed = tiles.filter((t) => t.x != null);
    const free = (p) => placed.every((t) => Math.abs(t.x - p.x) > TILE_W * 0.6 || Math.abs(t.y - p.y) > TILE_H * 0.6);
    const next = tiles.map((t) => {
      if (t.x != null) return t;
      let i = 0;
      while (!free(slot(i, w)) && i < 200) i++;
      const p = { ...t, ...slot(i, w) };
      placed.push(p);
      return p;
    });
    onChange(next);
  }, [tiles]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDown(e, i) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = pad.current.getBoundingClientRect();
    const t = tiles[i];
    dragRef.current = { i, dx: e.clientX - r.left - t.x, dy: e.clientY - r.top - t.y };
    // Bring the picked-up tile to the front by moving it to the end of the list.
    const next = [...tiles.slice(0, i), ...tiles.slice(i + 1), t];
    dragRef.current.i = next.length - 1;
    setLive(next);
  }

  function onMove(e) {
    const d = dragRef.current;
    if (!d || !live) return;
    const r = pad.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - r.left - d.dx), r.width - TILE_W);
    const y = Math.min(Math.max(0, e.clientY - r.top - d.dy), r.height - TILE_H);
    setLive(live.map((t, j) => (j === d.i ? { ...t, x, y } : t)));
  }

  function onUp() {
    if (live) onChange(live);
    dragRef.current = null;
    setLive(null);
  }

  function shuffle() {
    const { w } = size();
    const order = tiles.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    onChange(order.map((from, to) => ({ ...tiles[from], ...slot(to, w) })));
  }

  return (
    <section className="scratch" aria-label="Scratchpad" ref={section}>
      <div className="scratch-head">
        <span>Scratchpad</span>
        <div className="scratch-tools">
          <button type="button" className="link-btn" onClick={shuffle} disabled={tiles.length < 2}>
            Shuffle
          </button>
          <button type="button" className="link-btn" onClick={() => onChange([])} disabled={!tiles.length}>
            Clear
          </button>
          <button type="button" className="link-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      <div className="scratch-pad" ref={pad}>
        {shown.map((t, i) =>
          t.x == null ? null : (
            <span
              key={t.id ?? i}
              className={`scratch-tile${dragRef.current?.i === i && live ? ' is-dragging' : ''}`}
              style={{ left: Math.min(t.x, size().w - TILE_W), top: t.y }}
              onPointerDown={(e) => onDown(e, i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {t.ch}
            </span>
          ),
        )}
      </div>
      <p className="scratch-tip">
        {tiles.length ? 'Drag letters anywhere on the pad.' : 'Type letters here to try out anagrams.'}
      </p>
    </section>
  );
}

/** Clue text with indicator / fodder / definition highlighted. */
function ClueText({ text, marks }) {
  const kinds = Array.from({ length: text.length }, () => []);
  const lower = text.toLowerCase();
  for (const [kind, phrases] of Object.entries(marks)) {
    for (const ph of phrases) {
      const at = lower.indexOf(ph.toLowerCase());
      if (at < 0) continue;
      for (let i = at; i < at + ph.length; i++) kinds[i].push(kind);
    }
  }
  const parts = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || kinds[i].join() !== kinds[start].join()) {
      const k = kinds[start];
      const chunk = text.slice(start, i);
      parts.push(
        k.length ? (
          <span key={start} className={k.map((x) => `hl hl-${x}`).join(' ')}>
            {chunk}
          </span>
        ) : (
          chunk
        ),
      );
      start = i;
    }
  }
  return <>{parts}</>;
}

function ScribbleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13c2-4 5-7 7-6s-6 7-4 8 7-7 8-5-4 5-2 6 3-1 4-2" />
    </svg>
  );
}

function toArray(saved, n) {
  const arr = Array.isArray(saved) ? saved : String(saved ?? '').split('');
  return Array.from({ length: n }, (_, i) => arr[i] || '');
}
