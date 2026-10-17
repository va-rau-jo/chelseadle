// Small hand-drawn icons for the home tiles. Stroke uses currentColor.
const common = { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round', 'aria-hidden': true };

export function CrosswordIcon(props) {
  return (
    <svg {...common} {...props}>
      <rect x="6" y="6" width="36" height="36" rx="4" />
      <path d="M18 6v36M30 6v36M6 18h36M6 30h36" />
      <rect x="18" y="18" width="12" height="12" fill="currentColor" />
      <rect x="6" y="30" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

export function CrypticIcon(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="24" cy="27" r="16" />
      <path d="M20 5h8M24 5v6M24 27l6-7M37 13l3-3" />
    </svg>
  );
}

export function PhotoIcon(props) {
  return (
    <svg {...common} {...props}>
      <rect x="8" y="5" width="32" height="38" rx="3" transform="rotate(-6 24 24)" />
      <path d="M12 30l7-8 6 6 4-4 8 8" transform="rotate(-6 24 24)" />
      <circle cx="30" cy="16" r="3" transform="rotate(-6 24 24)" />
    </svg>
  );
}

export function TriviaIcon(props) {
  return (
    <svg {...common} {...props}>
      <path d="M8 10a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H22l-9 8v-8h-1a4 4 0 0 1-4-4z" />
      <path d="M19.5 15.5a4.5 4.5 0 1 1 6.3 4.1c-1.2.6-1.8 1.4-1.8 2.7" />
      <circle cx="24" cy="27" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function ChevronLeft(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function BackspaceIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
      <path d="M12 9l6 6M18 9l-6 6" />
    </svg>
  );
}

export const PUZZLE_ICONS = {
  crossword: CrosswordIcon,
  cryptic: CrypticIcon,
  photos: PhotoIcon,
  trivia: TriviaIcon,
};
