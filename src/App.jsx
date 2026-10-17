import { useEffect, useState } from 'react';
import Gate from './components/Gate.jsx';
import Home from './components/Home.jsx';
import { loadMeta, unlockWithSavedKey } from './lib/data.js';
import { PUZZLES, groupGuess, statusOf } from './lib/puzzles.js';
import { SessionProvider, loadProgress, useSession, verifyProgress } from './lib/session.jsx';
import { useHashRoute } from './lib/useHashRoute.js';
import Crossword from './puzzles/Crossword.jsx';
import Cryptic from './puzzles/Cryptic.jsx';
import Photos from './puzzles/Photos.jsx';
import Trivia from './puzzles/Trivia.jsx';

export default function App() {
  const [meta, setMeta] = useState(null);
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState(null);

  async function start(m, unlocked) {
    const progress = await verifyProgress(m, unlocked.content, loadProgress(m));
    setSession({ ...unlocked, progress });
  }

  useEffect(() => {
    (async () => {
      try {
        const m = await loadMeta();
        setMeta(m);
        const saved = await unlockWithSavedKey(m);
        if (saved) await start(m, saved);
      } catch (e) {
        setError(e.message);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  if (error) {
    return (
      <main className="gate">
        <p className="feedback">{error}</p>
      </main>
    );
  }
  if (booting) return <main className="gate" aria-busy="true" />;
  if (!session) return <Gate meta={meta} onUnlock={(u) => start(meta, u)} />;

  return (
    <SessionProvider meta={meta} content={session.content} imageKey={session.key} initialProgress={session.progress}>
      <Router />
    </SessionProvider>
  );
}

const PAGES = { crossword: Crossword, cryptic: Cryptic, photos: Photos, trivia: Trivia };

function Router() {
  useCompletionUnlocks();
  const route = useHashRoute();
  const Page = PAGES[route] ?? Home;
  return <Page />;
}

/** When a whole puzzle (or all four) is solved, unlock its hidden message. */
function useCompletionUnlocks() {
  const { content, solved, check, markSolved } = useSession();
  useEffect(() => {
    for (const p of PUZZLES) {
      const id = `${p.key}.complete`;
      const lock = content[p.key].completeLock;
      if (lock && !solved[id] && statusOf(content, solved, p.key).complete) {
        check(id, groupGuess(content, solved, p.key), [lock]).then((payload) => payload && markSolved(id, payload));
      }
    }
    const allDone = PUZZLES.every((p) => statusOf(content, solved, p.key).complete);
    if (content.finaleLock && allDone && !solved.finale) {
      const guess = PUZZLES.map((p) => groupGuess(content, solved, p.key)).join('');
      check('finale', guess, [content.finaleLock]).then((payload) => payload && markSolved('finale', payload));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);
}
