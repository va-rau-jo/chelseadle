import { useEffect, useState } from 'react';
import { PUZZLES, statusOf } from '../lib/puzzles.js';
import { useSession } from '../lib/session.jsx';
import { PUZZLE_ICONS } from './Icons.jsx';
import Wordmark from './Wordmark.jsx';

const NOUNS = { crossword: 'words', cryptic: 'clues', photos: 'photos', trivia: 'questions' };

export default function Home() {
  const { content, solved, progress, update } = useSession();
  const statuses = Object.fromEntries(PUZZLES.map((p) => [p.key, statusOf(content, solved, p.key)]));
  const allComplete = PUZZLES.every((p) => statuses[p.key].complete);

  // Puzzles finished since the last visit get their stamp animated once.
  const [freshStamps] = useState(() =>
    PUZZLES.filter((p) => statuses[p.key].complete && !progress.stamped?.[p.key]).map((p) => p.key),
  );
  useEffect(() => {
    if (freshStamps.length) {
      update((d) => {
        d.stamped ??= {};
        for (const k of freshStamps) d.stamped[k] = true;
      });
    }
  }, [freshStamps, update]);

  return (
    <main className="home">
      <header className="home-head">
        <Wordmark text={content.title} />
        {content.subtitle && <p className="subtitle">{content.subtitle}</p>}
      </header>

      <div className="tiles">
        {PUZZLES.map((p) => {
          const s = statuses[p.key];
          const Icon = PUZZLE_ICONS[p.key];
          const label = s.complete
            ? 'Tap to look back'
            : s.done === 0
              ? `${s.total} ${NOUNS[p.key]}`
              : `${s.done} of ${s.total} ${NOUNS[p.key]} solved`;
          return (
            <a
              key={p.key}
              href={`#/${p.key}`}
              className={`tile${s.complete ? ' is-complete' : ''}`}
              style={{ '--tile': p.color }}
            >
              <Icon className="tile-icon" />
              <span className="tile-title">{content[p.key].title}</span>
              <span className="tile-status">{label}</span>
              {!s.complete && s.done > 0 && (
                <span className="tile-meter" aria-hidden="true">
                  <span style={{ width: `${(s.done / s.total) * 100}%` }} />
                </span>
              )}
              {s.complete && (
                <span className={`stamp${freshStamps.includes(p.key) ? ' stamp-in' : ''}`} aria-label="Solved">
                  Solved
                </span>
              )}
            </a>
          );
        })}
      </div>

      {allComplete && <Finale />}

      <ResetButton />
    </main>
  );
}

function Finale() {
  const { content, solved } = useSession();
  const [open, setOpen] = useState(false);
  const finale = solved.finale;
  if (!content.finaleLock) {
    return (
      <section className="finale">
        <h2>All four solved.</h2>
        <p>Happy birthday!</p>
      </section>
    );
  }
  return (
    <section className="finale">
      <h2>All four solved.</h2>
      {!open ? (
        <button type="button" className="btn btn-finale" onClick={() => setOpen(true)} disabled={!finale}>
          Open your birthday message
        </button>
      ) : (
        <div className="finale-message">
          <h3>{finale.title}</h3>
          <p>{finale.message}</p>
        </div>
      )}
    </section>
  );
}

function ResetButton() {
  const { reset } = useSession();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <footer className="home-foot">
      <button
        type="button"
        className={`link-btn${armed ? ' is-armed' : ''}`}
        onClick={() => {
          if (armed) {
            reset();
            setArmed(false);
          } else setArmed(true);
        }}
      >
        {armed ? 'Tap again to erase all progress' : 'Start over'}
      </button>
    </footer>
  );
}
