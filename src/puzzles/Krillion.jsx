// Krillion: name something in the category. The rarer your answer, the more points,
// and every point sinks the krill 10 metres deeper. The whole page is one vertical
// ocean that the camera descends through as she scores.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MusicButton } from '../components/Music.jsx';
import { unmaskLetters } from '../lib/crypto.js';
import { useSession } from '../lib/session.jsx';

export const TIERS = {
  oneInAKrillion: { name: 'Krillion', long: 'One in a Krillion', points: 100, line: 'One in a krillion. Nobody else went this deep.' },
  // Not in the answer bank, but she said "Did I miss one?" and claimed it anyway.
  tooNiche: { name: 'Too niche', long: 'Too niche for me', points: 100, line: 'So rare it was not even on the list.' },
  deepCut: { name: 'Deep Cut', long: 'Deep Cut', points: 85, line: 'Strange waters. Almost nobody thinks of that.' },
  rare: { name: 'Rare', long: 'Rare', points: 60, line: 'A rare find. Few dive this far.' },
  schooler: { name: 'Schooler', long: 'Schooler', points: 30, line: 'Solid. Swims with the school.' },
  plankton: { name: 'Plankton', long: 'Plankton', points: 10, line: 'Plankton. Everyone thought of that one.' },
};
const TIER_ORDER = Object.keys(TIERS);
const NO_CATCH_LINE = 'No catch this round. The current carries you on.';
const METRES_PER_POINT = 10;
const PX_PER_M = 0.7; // how tall the ocean is on screen
const SURFACE = 150; // px from the top of the scene to the waterline
const KRILL_OFFSET = 140; // krill starts this far below the waterline

const pointsOf = (entry) => (entry?.tier ? TIERS[entry.tier]?.points ?? 0 : 0);

export default function Krillion() {
  const { content, solved, puzzleData, setPuzzleData, markSolved } = useSession();
  const k = content.krillion;
  const items = k.items;
  const started = puzzleData('krillion').started ?? {};
  const score = items.reduce((n, it) => n + pointsOf(solved[it.id]), 0);
  const depth = score * METRES_PER_POINT;
  const nextIndex = items.findIndex((it) => !solved[it.id]);
  const [reveal, setReveal] = useState(null);
  const now = useNow(200);
  const vp = useViewport();

  const begin = (i, delay = 900) =>
    setPuzzleData('krillion', (d) => {
      d.started ??= {};
      d.started[items[i].id] = Date.now() + delay;
    });

  let phase;
  if (reveal) phase = 'reveal';
  else if (nextIndex < 0) phase = 'summary';
  else if (started[items[nextIndex].id]) phase = now >= started[items[nextIndex].id] ? 'playing' : 'sinking';
  else phase = nextIndex === 0 ? 'title' : 'between';

  // Camera: the krill sinks down the screen until it reaches the middle, then the ocean scrolls.
  const krillWorldY = SURFACE + KRILL_OFFSET + depth * PX_PER_M;
  const anchor = Math.round(vp.h * 0.5);
  const krillScreenY = Math.min(krillWorldY, anchor);
  const camera = krillScreenY - krillWorldY;
  const oceanMetres = items.length * 100 * METRES_PER_POINT + 900;

  return (
    <div className="kd" style={{ top: vp.top, height: vp.h }}>
      <Ocean metres={oceanMetres} camera={camera} />

      {phase !== 'summary' && (
        <>
          <div className="kd-krill" style={{ top: krillScreenY }}>
            <Sprite name="krill" scale={3} />
          </div>
          <div className="kd-you" style={{ top: krillScreenY }} aria-hidden="true">
            <span>YOU</span>
          </div>
        </>
      )}

      <Hud items={items} solved={solved} current={nextIndex} depth={depth} score={score} />

      {phase === 'title' && <Title onStart={() => begin(0, 600)} />}

      {phase === 'between' && (
        <div className="kd-center">
          <button type="button" className="kd-btn" onClick={() => begin(nextIndex)}>
            Descend <span aria-hidden="true">▼</span>
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <Round
          key={items[nextIndex].id}
          item={items[nextIndex]}
          index={nextIndex}
          total={items.length}
          timeLimit={k.timeLimit}
          startedAt={started[items[nextIndex].id]}
          now={now}
          onDone={setReveal}
        />
      )}

      {phase === 'reveal' && (
        <Reveal
          entry={solved[reveal]}
          text={k.tierText ?? {}}
          last={nextIndex < 0}
          onClaim={(answer) =>
            markSolved(reveal, { ...solved[reveal], answer, tier: 'tooNiche', claimed: true, passed: false })
          }
          onNext={() => {
            setReveal(null);
            if (nextIndex >= 0) begin(nextIndex);
          }}
        />
      )}

      {phase === 'summary' && <Summary items={items} score={score} note={k.completeNote} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The ocean                                                            */

function Ocean({ metres, camera }) {
  const height = SURFACE + metres * PX_PER_M;
  const at = (m) => SURFACE + m * PX_PER_M;
  const water = `linear-gradient(to bottom,
    #cfe4ea 0px, #e8f2f4 ${SURFACE - 8}px,
    #8fd0e0 ${SURFACE - 2}px, #1f5d8a ${SURFACE + 4}px,
    #184c75 ${at(200)}px, #10345a ${at(1000)}px,
    #0a1f3b ${at(2500)}px, #060f22 ${at(4000)}px, #03070f ${height}px)`;

  // Deterministic sea life so it doesn't jump around between renders.
  const life = useMemo(() => {
    const rand = mulberry(7);
    const fish = [];
    for (let m = 40; m < metres; m += 70 + rand() * 120) {
      const school = rand() < 0.35;
      fish.push({
        y: at(m),
        count: school ? 5 + Math.floor(rand() * 8) : 1,
        size: school ? 10 + rand() * 4 : 14 + rand() * 18,
        dur: 28 + rand() * 40,
        delay: -rand() * 60,
        flip: rand() < 0.5,
      });
    }
    const ticks = [];
    for (let m = 0; m <= metres; m += 50) ticks.push(m);
    return { fish, ticks };
  }, [metres]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kd-ocean" aria-hidden="true">
      <div className="kd-scene" style={{ height, background: water, transform: `translateY(${camera}px)` }}>
        <div className="kd-rays" style={{ top: SURFACE }} />
        <div className="kd-boat" style={{ top: SURFACE - 66 }}>
          <Sprite name="boat" scale={3} />
        </div>
        <svg className="kd-waves" style={{ top: SURFACE - 6 }} viewBox="0 0 400 12" preserveAspectRatio="none">
          <path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 T250 6 T300 6 T350 6 T400 6 V12 H0Z" fill="#8fd0e0" />
        </svg>

        {life.fish.map((f, i) => (
          <div
            key={i}
            className={`kd-fish${f.flip ? ' is-flipped' : ''}`}
            style={{ top: f.y, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
          >
            {Array.from({ length: f.count }, (_, j) => (
              <Fish key={j} size={f.size} style={f.count > 1 ? { marginTop: (j % 3) * 6 - 6 } : null} />
            ))}
          </div>
        ))}

        <div className="kd-ruler">
          {life.ticks.map((m) => (
            <div key={m} className={`kd-tick${m % 100 === 0 ? ' is-major' : ''}`} style={{ top: at(m) }}>
              {m % 100 === 0 && m > 0 && <span>-{m}m</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="kd-scanlines" />
    </div>
  );
}

function Fish({ size, style }) {
  return (
    <svg viewBox="0 0 24 10" width={size * 2.4} height={size} style={style}>
      <ellipse cx="10" cy="5" rx="9" ry="4" fill="currentColor" />
      <path d="M17 5l6-4v8z" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* HUD, title, round, reveal                                           */

function Hud({ items, solved, current, depth, score }) {
  const shownDepth = useCountUp(depth);
  return (
    <header className="kd-hud">
      <a className="kd-icon-btn" href="#/" aria-label="Back to puzzles">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </a>
      <div className="kd-panel kd-stat">
        <span>Depth</span>
        <strong className="is-cyan">{Math.round(shownDepth).toLocaleString()}m</strong>
      </div>
      <div className="kd-steps" aria-label={`Prompt ${Math.min(current < 0 ? items.length : current + 1, items.length)} of ${items.length}`}>
        <div className="kd-squares">
          {items.map((it, i) => {
            const e = solved[it.id];
            return (
              <span
                key={it.id}
                className={`kd-square${e ? ` tier-${e.tier ?? 'none'}` : ''}${i === current ? ' is-current' : ''}`}
              />
            );
          })}
        </div>
        <span className="kd-steps-label">
          Prompt {Math.min(current < 0 ? items.length : current + 1, items.length)} of {items.length}
        </span>
      </div>
      <div className="kd-panel kd-stat is-right">
        <span>Score</span>
        <strong className="is-pink">{Math.round(shownDepth / METRES_PER_POINT)}</strong>
      </div>
      <div className="kd-music">
        <MusicButton />
      </div>
    </header>
  );
}

function Title({ onStart }) {
  return (
    <div className="kd-center kd-title">
      <h1 className="kd-logo">Krillion</h1>
      <p className="kd-sub">The daily dive</p>
      <button type="button" className="kd-btn is-pink" onClick={onStart}>
        Start dive <span aria-hidden="true">▼</span>
      </button>
    </div>
  );
}

function Round({ item, index, total, timeLimit, startedAt, now, onDone }) {
  const { check, markSolved } = useSession();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | miss
  const finishing = useRef(false);
  const input = useRef(null);
  const remaining = timeLimit ? Math.max(0, timeLimit - (now - startedAt) / 1000) : null;

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  function finish(entry) {
    if (finishing.current) return;
    finishing.current = true;
    markSolved(item.id, entry);
    onDone(item.id);
  }

  async function submit(e) {
    e?.preventDefault();
    if (!value.trim() || status === 'checking' || finishing.current) return;
    setStatus('checking');
    const payload = await check(item.id, value, item.locks);
    if (payload) finish({ answer: payload.answer, tier: payload.tier, guess: value });
    else setStatus('miss');
  }

  // Time's up: whatever she typed gets submitted.
  useEffect(() => {
    if (remaining == null || remaining > 0 || finishing.current) return;
    (async () => {
      const payload = value.trim() ? await check(item.id, value, item.locks) : null;
      if (payload) finish({ answer: payload.answer, tier: payload.tier, guess: value });
      else finish({ passed: true, timedOut: true, answer: null, tier: null, guess: value || null });
    })();
  }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const frac = remaining == null ? 1 : remaining / timeLimit;

  return (
    <>
      <section className="kd-panel kd-prompt">
        <p className="kd-prompt-count">
          Prompt {index + 1} of {total}
        </p>
        <h2>{item.prompt}</h2>
        <p className="kd-prompt-hint">▼ rarer answers sink deeper ▼</p>
      </section>

      <form className="kd-bar" onSubmit={submit}>
        {remaining != null && (
          <div className={`kd-timer${remaining <= 5 ? ' is-low' : ''}`} role="timer" aria-label={`${Math.ceil(remaining)} seconds left`}>
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="19" className="kd-timer-track" />
              <circle cx="22" cy="22" r="19" className="kd-timer-fill" style={{ strokeDashoffset: 119.4 * (1 - frac) }} />
            </svg>
            <span>{Math.ceil(remaining)}</span>
          </div>
        )}
        <div className="kd-input-wrap">
          <label className="sr-only" htmlFor={`k-${item.id}`}>
            Your answer
          </label>
          <input
            id={`k-${item.id}`}
            ref={input}
            className={status === 'miss' ? 'is-miss' : ''}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (status === 'miss') setStatus('idle');
            }}
            placeholder="type one answer…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            enterKeyHint="go"
          />
          <div className="kd-input-time" aria-hidden="true">
            <span style={{ width: `${frac * 100}%` }} />
          </div>
          {status === 'miss' && (
            <p className="kd-miss" role="status">
              Not in the answer bank. Try another.
            </p>
          )}
        </div>
        <button type="submit" className="kd-dive" disabled={!value.trim() || status === 'checking'}>
          Dive
        </button>
        <button
          type="button"
          className="kd-pass"
          onClick={() => finish({ passed: true, answer: null, tier: null, guess: value || null })}
        >
          Pass
        </button>
      </form>
    </>
  );
}

function Reveal({ entry, text, last, onClaim, onNext }) {
  const tier = entry?.tier ? TIERS[entry.tier] : null;
  const [claiming, setClaiming] = useState(false);
  const [value, setValue] = useState(entry?.guess ?? '');
  const key = entry?.tier ?? 'none';

  function claim(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setClaiming(false);
    onClaim(value.trim());
  }

  return (
    <div className="kd-center kd-reveal" aria-live="polite" key={key}>
      <div className="kd-reveal-sprite">
        <Sprite name={key} scale={5} />
      </div>
      <h2 className={`kd-tier-name tier-text-${key}${(tier?.long ?? '').length > 12 ? ' is-long' : ''}`}>
        {tier ? tier.long : entry?.timedOut ? "Time's up" : 'Passed'}
      </h2>
      {entry?.answer && <p className="kd-quote">&ldquo;{entry.answer}&rdquo;</p>}
      <p className="kd-points">
        <span className={`tier-text-${key}`}>+{tier?.points ?? 0} PTS</span> · sink {(tier?.points ?? 0) * METRES_PER_POINT}m
      </p>
      <p className="kd-line">{text[key] ?? (tier ? tier.line : NO_CATCH_LINE)}</p>

      {!tier &&
        (claiming ? (
          <form className="kd-claim" onSubmit={claim}>
            <label className="sr-only" htmlFor="kd-claim">
              Your answer
            </label>
            <input
              id="kd-claim"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="what did you have?"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              enterKeyHint="go"
            />
            <button type="submit" className="kd-dive" disabled={!value.trim()}>
              Submit
            </button>
          </form>
        ) : (
          <button type="button" className="kd-miss-btn" onClick={() => setClaiming(true)}>
            Did I miss one?
          </button>
        ))}

      <button type="button" className="kd-btn" onClick={onNext}>
        {last ? 'See the catch' : 'Descend'} <span aria-hidden="true">▼</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The catch: end-of-dive review                                       */

function Summary({ items, score, note }) {
  const { solved } = useSession();
  const [open, setOpen] = useState(null);
  return (
    <div className="kd-summary">
      <div className="kd-summary-inner">
        <h1 className="kd-logo is-small">Krillion</h1>
        <p className="kd-done">Dive complete</p>
        <p className="kd-final">
          <strong>{score}</strong> / {items.length * 100}
          <span> · {(score * METRES_PER_POINT).toLocaleString()}m down</span>
        </p>
        {note && <p className="kd-note">{note}</p>}

        <h2 className="kd-catch-head">
          The catch <span>tap a round for every answer</span>
        </h2>
        <ol className="kd-rounds">
          {items.map((it, i) => {
            const e = solved[it.id];
            const isOpen = open === it.id;
            return (
              <li key={it.id} className={isOpen ? 'is-open' : ''}>
                <button type="button" className="kd-round" onClick={() => setOpen(isOpen ? null : it.id)} aria-expanded={isOpen}>
                  <span className="kd-round-num">{i + 1}</span>
                  <span className="kd-round-icon">
                    <Sprite name={e?.tier ?? 'none'} scale={2} />
                  </span>
                  <span className="kd-round-body">
                    <span className="kd-round-prompt">{it.prompt}</span>
                    <span className="kd-round-answer">{e?.answer ?? (e?.timedOut ? "Time's up" : 'Passed')}</span>
                  </span>
                  <span className={`kd-round-pts tier-text-${e?.tier ?? 'none'}`}>{pointsOf(e)}</span>
                  <span className="kd-round-caret" aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </button>
                {isOpen && <AnswerSheet item={it} mine={e?.answer} claimed={!!e?.claimed} />}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function AnswerSheet({ item, mine, claimed }) {
  const { meta } = useSession();
  const [sheet, setSheet] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    unmaskLetters(meta.salt, `${item.id}|sheet`, item.sheet).then((s) => setSheet(JSON.parse(s)));
  }, [item, meta.salt]);

  if (!sheet) return <div className="kd-sheet">Loading…</div>;
  const rows = [
    ...(claimed && mine ? [{ tier: 'tooNiche', answer: mine }] : []),
    ...sheet
      .filter((g) => TIERS[g.tier])
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
      .flatMap((g) => g.answers.map((a) => ({ tier: g.tier, answer: a }))),
  ];
  const counts = Object.fromEntries(TIER_ORDER.map((t) => [t, rows.filter((r) => r.tier === t).length]));
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (filter === 'all' || r.tier === filter) && (!q || r.answer.toLowerCase().includes(q)));

  return (
    <div className="kd-sheet">
      <div className="kd-chips" role="group" aria-label="Filter by tier">
        <button type="button" className={`kd-chip${filter === 'all' ? ' is-on' : ''}`} onClick={() => setFilter('all')}>
          All {rows.length}
        </button>
        {TIER_ORDER.filter((t) => counts[t]).map((t) => (
          <button
            type="button"
            key={t}
            className={`kd-chip tier-text-${t}${filter === t ? ' is-on' : ''}`}
            onClick={() => setFilter(filter === t ? 'all' : t)}
          >
            {TIERS[t].name} {counts[t]}
          </button>
        ))}
      </div>
      <input
        className="kd-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${filter === 'all' ? '' : `${TIERS[filter].name} `}answers…`}
        aria-label="Search answers"
      />
      <ul className="kd-answers">
        {shown.map((r) => (
          <li key={r.tier + r.answer} className={r.answer === mine ? 'is-mine' : ''}>
            <Sprite name={r.tier} scale={2} />
            <span className="kd-answer">{r.answer}</span>
            {r.answer === mine && <span className="kd-mine">your pick</span>}
            <span className={`kd-answer-pts tier-text-${r.tier}`}>+{TIERS[r.tier].points}</span>
          </li>
        ))}
      </ul>
      <p className="kd-sheet-count">
        {shown.length} of {filter === 'all' ? rows.length : counts[filter]} answers
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pixel sprites                                                        */

const SPRITES = {
  krill: {
    pal: { r: '#ff4d6d', p: '#ff8fa3', k: '#1a0b14', w: '#ffe3ea' },
    map: `
....r.r.....
.....r.r....
..rrrrr.....
.rppppprr...
rpkpppppprr.
rppppppppppr
.rpppwppppr.
..rrpppprr..
...r.rr.r...
..r..r..r...`,
  },
  oneInAKrillion: {
    pal: { r: '#ffb400', p: '#ffd23f', k: '#2a1a00', w: '#fff6c9' },
    map: `
....r.r.....
.....r.r....
..rrrrr.....
.rppppprr...
rpkpppppprr.
rppppppppppr
.rpppwppppr.
..rrpppprr..
...r.rr.r...
..r..r..r...`,
  },
  get tooNiche() {
    return this.oneInAKrillion;
  },
  deepCut: {
    pal: { p: '#a77bff', d: '#6f45d9', y: '#ffe680', k: '#120a24', w: '#e6dcff' },
    map: `
y...........
.d..........
..d...pppp..
.....pppppp.
....ppkpppppp
dd.pppppppppp
.ddppwwwpppp.
dd..ppppppp..
.....pppp....`,
  },
  rare: {
    pal: { r: '#ff4d5e', d: '#c22a3a' },
    map: `
r...r...r
r.r.r.r.r
.rr.r.rr.
..rrrrr..
...rrr...
....r....
....d....
...ddd...`,
  },
  schooler: {
    pal: { c: '#3fd6ff', d: '#1d9bc4', k: '#06202b' },
    map: `
.....c......
...cccc...c.
.ccccccccccc
cckcccccccd.
.ccccccccccc
...cdcc...c.
.....c......`,
  },
  plankton: {
    pal: { g: '#9aa3b5' },
    map: `
.g....g.
ggg..ggg
.g....g.
...gg...
...gg...
.g....g.
ggg..ggg
.g....g.`,
  },
  none: {
    pal: { g: '#55607a' },
    map: `
g.....g
.g...g.
..g.g..
...g...
..g.g..
.g...g.
g.....g`,
  },
  boat: {
    pal: { n: '#13203a', f: '#ff5d8f', w: '#7fb6c9' },
    map: `
..............n.................
..............nff...............
..............nfff..............
..............nff...............
..............n.................
..............n.................
.........nnnnnnnnnnn............
.........n.ww.n.ww.n............
.........nnnnnnnnnnn......nnn...
nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.
.nnnnnnnnnnnnnnnnnnnnnnnnnnnnn..
..nnnnnnnnnnnnnnnnnnnnnnnnnnn...
...nnnnnnnnnnnnnnnnnnnnnnnnn....`,
  },
};

function Sprite({ name, scale = 3 }) {
  const s = SPRITES[name] ?? SPRITES.none;
  const rows = s.map.trim().split('\n');
  const w = Math.max(...rows.map((r) => r.length));
  const rects = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (s.pal[ch]) rects.push(<rect key={`${x},${y}`} x={x} y={y} width="1.02" height="1.02" fill={s.pal[ch]} />);
    }),
  );
  return (
    <svg
      className={`sprite sprite-${name}`}
      viewBox={`0 0 ${w} ${rows.length}`}
      width={w * scale}
      height={rows.length * scale}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Little hooks                                                         */

function useNow(ms) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** The visible screen area, so the answer bar sits right above the phone keyboard. */
function useViewport() {
  const get = () => ({
    h: Math.round(window.visualViewport?.height ?? window.innerHeight),
    top: Math.round(window.visualViewport?.offsetTop ?? 0),
  });
  const [v, setV] = useState(get);
  useEffect(() => {
    const f = () => setV(get());
    const vv = window.visualViewport;
    vv?.addEventListener('resize', f);
    vv?.addEventListener('scroll', f);
    window.addEventListener('resize', f);
    return () => {
      vv?.removeEventListener('resize', f);
      vv?.removeEventListener('scroll', f);
      window.removeEventListener('resize', f);
    };
  }, []);
  return v;
}

function useCountUp(target) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || a === target) {
      from.current = target;
      setValue(target);
      return;
    }
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / 1600);
      const v = a + (target - a) * (1 - (1 - p) ** 3);
      setValue(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
