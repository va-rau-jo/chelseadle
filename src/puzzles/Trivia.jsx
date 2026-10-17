import { useState } from 'react';
import { GuessForm, Hints, ItemNav, PuzzleLayout, SolvedNote, usePosition } from '../components/Shared.jsx';
import { normalize } from '../lib/crypto.js';
import { useSession } from '../lib/session.jsx';

export default function Trivia() {
  const { content } = useSession();
  const items = content.trivia.items;
  const { pos, setPos, nextUnsolved } = usePosition('trivia', items);
  return (
    <PuzzleLayout puzzleKey="trivia">
      <ItemNav items={items} pos={pos} setPos={setPos} />
      <Question key={items[pos].id} item={items[pos]} number={pos + 1} nextUnsolved={nextUnsolved} setPos={setPos} />
    </PuzzleLayout>
  );
}

function Question({ item, number, nextUnsolved, setPos }) {
  const { solved, check, markSolved, puzzleData, setPuzzleData } = useSession();
  const entry = solved[item.id];
  const data = puzzleData('trivia');
  const wrong = data.wrong?.[item.id] ?? [];
  const hintsShown = data.hints?.[item.id] ?? 0;
  const [checking, setChecking] = useState(null);

  async function pick(choice) {
    if (entry || checking || wrong.includes(choice)) return;
    setChecking(choice);
    const payload = await check(item.id, choice, item.locks);
    setChecking(null);
    if (payload) markSolved(item.id, { answer: payload.answer, note: payload.note });
    else
      setPuzzleData('trivia', (d) => {
        d.wrong ??= {};
        d.wrong[item.id] = [...(d.wrong[item.id] ?? []), choice];
      });
  }

  return (
    <div className="trivia">
      <p className="trivia-number">Question {number}</p>
      <h2 className="trivia-q">{item.question}</h2>

      {item.choices && (
        <div className="choices">
          {item.choices.map((choice) => {
            const isRight = entry && normalize(choice) === normalize(entry.answer);
            const isWrong = wrong.includes(choice);
            return (
              <button
                type="button"
                key={choice}
                className={`choice${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}`}
                onClick={() => pick(choice)}
                disabled={!!entry || isWrong || !!checking}
                aria-label={`${choice}${isRight ? ', correct' : isWrong ? ', wrong' : ''}`}
              >
                <span>{choice}</span>
                {isRight && <span aria-hidden="true">✓</span>}
                {isWrong && <span aria-hidden="true">✕</span>}
              </button>
            );
          })}
        </div>
      )}

      {entry ? (
        <SolvedNote
          entry={entry}
          hideAnswer={!!item.choices}
          onNext={nextUnsolved() >= 0 ? () => setPos(nextUnsolved()) : null}
        />
      ) : (
        <>
          {!item.choices && (
            <GuessForm id={item.id} locks={item.locks} onSolved={(p) => markSolved(item.id, { answer: p.answer, note: p.note })} />
          )}
          {item.choices && wrong.length > 0 && (
            <p className="feedback" role="status">
              Not that one. Try again.
            </p>
          )}
          <Hints
            hints={item.hints}
            shown={hintsShown}
            onReveal={() =>
              setPuzzleData('trivia', (d) => {
                d.hints ??= {};
                d.hints[item.id] = hintsShown + 1;
              })
            }
          />
        </>
      )}
    </div>
  );
}
