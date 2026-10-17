import { useState } from 'react';
import { PUZZLES, statusOf } from '../lib/puzzles.js';
import { useSession } from '../lib/session.jsx';
import { ChevronLeft, ChevronRight } from './Icons.jsx';

export function PuzzleLayout({ puzzleKey, children }) {
  const { content, solved } = useSession();
  const p = PUZZLES.find((x) => x.key === puzzleKey);
  const section = content[puzzleKey];
  const status = statusOf(content, solved, puzzleKey);
  return (
    <div className="puzzle" style={{ '--accent': p.color, '--tint': p.tint }}>
      <header className="topbar">
        <a className="back" href="#/">
          <ChevronLeft width="20" height="20" />
          Puzzles
        </a>
        <h1>{section.title}</h1>
        <span className="pill" aria-label={`${status.done} of ${status.total} solved`}>
          {status.done}/{status.total}
        </span>
      </header>
      <main className="puzzle-body">
        {status.complete ? (
          <CompleteBanner puzzleKey={puzzleKey} />
        ) : (
          section.intro && <p className="intro">{section.intro}</p>
        )}
        {children}
      </main>
    </div>
  );
}

function CompleteBanner({ puzzleKey }) {
  const { solved } = useSession();
  const message = solved[`${puzzleKey}.complete`]?.message;
  return (
    <section className="complete-banner" aria-live="polite">
      <strong>Solved!</strong>
      {message ? <p>{message}</p> : <p>Everything here is done. Head back to try another puzzle.</p>}
    </section>
  );
}

/** Prev / next arrows plus a dot per question. Dots fill in once solved. */
export function ItemNav({ items, pos, setPos, noun = 'Question' }) {
  const { solved } = useSession();
  if (items.length < 2) return null;
  return (
    <nav className="item-nav" aria-label={`${noun}s`}>
      <button type="button" className="icon-btn" onClick={() => setPos(pos - 1)} disabled={pos === 0} aria-label={`Previous ${noun.toLowerCase()}`}>
        <ChevronLeft width="22" height="22" />
      </button>
      <div className="dots">
        {items.map((it, i) => (
          <button
            type="button"
            key={it.id}
            className={`dot${solved[it.id] ? ' is-solved' : ''}${i === pos ? ' is-current' : ''}`}
            onClick={() => setPos(i)}
            aria-label={`${noun} ${i + 1}${solved[it.id] ? ', solved' : ''}`}
            aria-current={i === pos ? 'step' : undefined}
          />
        ))}
      </div>
      <button type="button" className="icon-btn" onClick={() => setPos(pos + 1)} disabled={pos === items.length - 1} aria-label={`Next ${noun.toLowerCase()}`}>
        <ChevronRight width="22" height="22" />
      </button>
    </nav>
  );
}

/** Remembers which question you were on in each puzzle. */
export function usePosition(puzzleKey, items) {
  const { puzzleData, setPuzzleData, solved } = useSession();
  const saved = puzzleData(puzzleKey).pos;
  // First visit: start at the first unsolved question (fixed for this visit, so solving
  // a question doesn't yank you away from its answer).
  const [firstUnsolved] = useState(() => Math.max(0, items.findIndex((it) => !solved[it.id])));
  const pos = Math.min(Math.max(0, saved ?? firstUnsolved), items.length - 1);
  const setPos = (i) => setPuzzleData(puzzleKey, (d) => void (d.pos = Math.min(Math.max(0, i), items.length - 1)));
  const nextUnsolved = () => {
    for (let step = 1; step <= items.length; step++) {
      const i = (pos + step) % items.length;
      if (!solved[items[i].id]) return i;
    }
    return -1;
  };
  return { pos, setPos, nextUnsolved };
}

/** Free-text answer box. */
export function GuessForm({ id, locks, onSolved, label = 'Your answer' }) {
  const { check } = useSession();
  const [value, setValue] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | wrong
  async function submit(e) {
    e.preventDefault();
    if (!value.trim() || state === 'checking') return;
    setState('checking');
    const payload = await check(id, value, locks);
    if (payload) onSolved(payload, value);
    else setState('wrong');
  }
  return (
    <form className="guess" onSubmit={submit}>
      <label className="sr-only" htmlFor={`guess-${id}`}>
        {label}
      </label>
      <div className={`guess-row${state === 'wrong' ? ' is-wrong' : ''}`}>
        <input
          id={`guess-${id}`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state === 'wrong') setState('idle');
          }}
          placeholder={label}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          enterKeyHint="go"
        />
        <button type="submit" className="btn btn-primary" disabled={!value.trim() || state === 'checking'}>
          Guess
        </button>
      </div>
      <p className="feedback" role="status">
        {state === 'wrong' ? 'Not quite. Try again, or take a hint.' : ' '}
      </p>
    </form>
  );
}

/** Reveals hints one at a time. */
export function Hints({ hints, shown, onReveal }) {
  if (!hints.length) return null;
  const visible = hints.slice(0, shown);
  const left = hints.length - shown;
  return (
    <div className="hints">
      {visible.length > 0 && (
        <ol className="hint-list">
          {visible.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      )}
      {left > 0 && onReveal && (
        <button type="button" className="btn btn-ghost" onClick={onReveal}>
          {shown === 0 ? 'Show a hint' : 'Show another hint'} ({left} left)
        </button>
      )}
    </div>
  );
}

/** Shown after an item is solved. */
export function SolvedNote({ entry, onNext, hideAnswer = false }) {
  if (hideAnswer && !entry.note && !onNext) return null;
  return (
    <div className="solved-note" aria-live="polite">
      {!hideAnswer && (
        <p className="solved-answer">
          <span className="check" aria-hidden="true">✓</span> {entry.answer}
        </p>
      )}
      {entry.note && <p className={hideAnswer ? 'note note-only' : 'note'}>{entry.note}</p>}
      {onNext && (
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Next unsolved
        </button>
      )}
    </div>
  );
}
