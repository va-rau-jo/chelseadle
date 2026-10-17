import { useState } from 'react';
import { Keyboard, usePhysicalKeys } from '../components/Keyboard.jsx';
import { Hints, ItemNav, PuzzleLayout, SolvedNote, usePosition } from '../components/Shared.jsx';
import { normalize } from '../lib/crypto.js';
import { useSession } from '../lib/session.jsx';

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
  const { solved, check, markSolved, puzzleData, setPuzzleData } = useSession();
  const state = puzzleData('cryptic')[item.id] ?? {};
  const typed = state.letters ?? '';
  const hintsShown = state.hints ?? 0;
  const entry = solved[item.id];
  const [status, setStatus] = useState('idle'); // idle | checking | wrong

  // The definition counts as the first hint, Minute Cryptic style.
  const hintTexts = [...(item.definition ? ['The definition is underlined in the clue.'] : []), ...item.hints];
  const showDefinition = item.definition && (hintsShown > 0 || entry);

  const save = (fn) =>
    setPuzzleData('cryptic', (d) => {
      d[item.id] ??= {};
      fn(d[item.id]);
    });

  async function submit(letters = typed) {
    if (entry || letters.length !== item.length || status === 'checking') return;
    setStatus('checking');
    const payload = await check(item.id, letters, item.locks);
    if (payload) {
      markSolved(item.id, { answer: payload.answer, note: payload.note, hints: hintsShown });
      setStatus('idle');
    } else setStatus('wrong');
  }

  function typeLetter(ch) {
    if (entry || typed.length >= item.length) return;
    const next = typed + ch;
    save((d) => void (d.letters = next));
    setStatus('idle');
    if (next.length === item.length) submit(next);
  }

  function backspace() {
    if (entry || !typed) return;
    save((d) => void (d.letters = typed.slice(0, -1)));
    setStatus('idle');
  }

  usePhysicalKeys((e) => {
    if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toUpperCase());
    else if (e.key === 'Backspace') backspace();
    else if (e.key === 'Enter') submit();
    else return;
    e.preventDefault();
  }, !entry);

  // Letter boxes, grouped by word: (5) or (3,5) etc.
  const shown = entry ? normalize(entry.answer).toUpperCase() : typed;
  let index = 0;
  const groups = item.groups.map((g, gi) => {
    const boxes = Array.from({ length: g.len }, () => {
      const i = index++;
      const cls = ['box'];
      if (entry) cls.push('is-solved');
      else if (i === typed.length) cls.push('is-next');
      return (
        <span key={i} className={cls.join(' ')}>
          {shown[i] ?? ''}
        </span>
      );
    });
    return (
      <span key={gi} className="box-group">
        {boxes}
        {g.sep === '-' && <span className="box-hyphen" aria-hidden="true">-</span>}
      </span>
    );
  });
  const enumeration = item.groups.map((g) => g.len + (g.sep === '-' ? '-' : g.sep ? ',' : '')).join('');

  return (
    <div className="cryptic">
      <p className="cryptic-clue">
        <ClueText text={item.clue} definition={showDefinition ? item.definition : null} />{' '}
        <span className="enum">({enumeration})</span>
      </p>

      <div
        className={`boxes${status === 'wrong' ? ' is-wrong' : ''}`}
        aria-label={entry ? `Answer: ${entry.answer}` : `Your answer so far: ${typed || 'empty'}`}
        role="status"
      >
        {groups}
      </div>

      {entry ? (
        <>
          <SolvedNote entry={entry} onNext={nextUnsolved() >= 0 ? () => setPos(nextUnsolved()) : null} />
          <p className="meta-line">
            {entry.hints ? `Solved with ${entry.hints} hint${entry.hints === 1 ? '' : 's'}.` : 'Solved with no hints.'}
          </p>
        </>
      ) : (
        <>
          <p className="feedback" role="status">
            {status === 'wrong' ? 'Not quite. Delete some letters and try again.' : ' '}
          </p>
          <Hints hints={hintTexts} shown={hintsShown} onReveal={() => save((d) => void (d.hints = hintsShown + 1))} />
          <Keyboard
            onLetter={typeLetter}
            onBackspace={backspace}
            onEnter={() => submit()}
            enterDisabled={typed.length !== item.length}
          />
        </>
      )}
    </div>
  );
}

function ClueText({ text, definition }) {
  if (!definition) return <>{text}</>;
  const i = text.toLowerCase().indexOf(definition.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="definition">{text.slice(i, i + definition.length)}</span>
      {text.slice(i + definition.length)}
    </>
  );
}
