import { useEffect, useRef } from 'react';
import { BackspaceIcon } from './Icons.jsx';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** On-screen keyboard, so the phone's own keyboard never covers the puzzle. */
export function Keyboard({ onLetter, onBackspace, onEnter, enterLabel = 'Check', enterDisabled }) {
  return (
    <div className="kb" role="group" aria-label="Keyboard">
      {ROWS.map((row, r) => (
        <div className="kb-row" key={row}>
          {r === 2 && onEnter && (
            <button type="button" className="kb-key kb-wide kb-enter" onClick={onEnter} disabled={enterDisabled}>
              {enterLabel}
            </button>
          )}
          {[...row].map((ch) => (
            <button type="button" key={ch} className="kb-key" onClick={() => onLetter(ch)}>
              {ch}
            </button>
          ))}
          {r === 2 && (
            <button type="button" className="kb-key kb-wide" onClick={onBackspace} aria-label="Delete">
              <BackspaceIcon width="22" height="22" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Lets a physical keyboard drive the puzzle (ignored while typing in a text box). */
export function usePhysicalKeys(handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
