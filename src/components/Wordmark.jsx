// The title spelled out in tiles that cycle through the four puzzle colours.
const COLORS = ['var(--crossword)', 'var(--cryptic)', 'var(--photos)', 'var(--trivia)'];

export default function Wordmark({ text, size = 'large' }) {
  return (
    <h1 className={`wordmark wordmark-${size}`} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden="true" style={{ '--tile': COLORS[i % COLORS.length], '--i': i }}>
          {ch}
        </span>
      ))}
    </h1>
  );
}
