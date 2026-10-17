import { useEffect, useState } from 'react';

// Tiny router: #/ is home, #/crossword etc. are puzzles. Hash URLs work on GitHub Pages
// without any server config.
const read = () => window.location.hash.replace(/^#\/?/, '');

export function useHashRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(route) {
  window.location.hash = `#/${route}`;
}
