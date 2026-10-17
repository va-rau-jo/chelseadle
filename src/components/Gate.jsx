import { useState } from 'react';
import { unlockWithPassword } from '../lib/data.js';
import Wordmark from './Wordmark.jsx';

export default function Gate({ meta, onUnlock }) {
  const [password, setPassword] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | wrong

  async function submit(e) {
    e.preventDefault();
    if (!password.trim() || state === 'checking') return;
    setState('checking');
    const result = await unlockWithPassword(meta, password);
    if (result) await onUnlock(result);
    else setState('wrong');
  }

  return (
    <main className="gate">
      <Wordmark text={meta.title} />
      <form className="gate-form" onSubmit={submit}>
        <label htmlFor="password">Password</label>
        {meta.passwordHint && <p className="gate-hint">{meta.passwordHint}</p>}
        <input
          id="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (state === 'wrong') setState('idle');
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          enterKeyHint="go"
          className={state === 'wrong' ? 'is-wrong' : ''}
          aria-describedby="gate-error"
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={!password.trim() || state === 'checking'}>
          {state === 'checking' ? 'Unlocking…' : 'Unlock'}
        </button>
        <p id="gate-error" className="feedback" role="alert">
          {state === 'wrong' ? "That's not the password. Capitals and spaces don't matter." : ' '}
        </p>
      </form>
    </main>
  );
}
