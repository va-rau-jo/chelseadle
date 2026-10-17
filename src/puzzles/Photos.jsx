import { useEffect, useState } from 'react';
import { GuessForm, Hints, ItemNav, PuzzleLayout, SolvedNote, usePosition } from '../components/Shared.jsx';
import { loadImage } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';

export default function Photos() {
  const { content } = useSession();
  const items = content.photos.items;
  const { pos, setPos, nextUnsolved } = usePosition('photos', items);
  return (
    <PuzzleLayout puzzleKey="photos">
      <ItemNav items={items} pos={pos} setPos={setPos} noun="Photo" />
      <PhotoItem key={items[pos].id} item={items[pos]} index={pos} nextUnsolved={nextUnsolved} setPos={setPos} />
    </PuzzleLayout>
  );
}

function PhotoItem({ item, index, nextUnsolved, setPos }) {
  const { imageKey, solved, markSolved, puzzleData, setPuzzleData } = useSession();
  const entry = solved[item.id];
  const hintsShown = puzzleData('photos').hints?.[item.id] ?? 0;
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadImage(imageKey, item.image)
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [imageKey, item.image]);

  return (
    <div className="photo-item">
      <figure className="polaroid" style={{ '--tilt': index % 2 ? '1.2deg' : '-1.4deg' }}>
        <div className="polaroid-img">
          {src ? (
            <img src={src} alt="A photo to guess about" />
          ) : (
            <span className="polaroid-wait">{failed ? "This photo didn't load. Refresh to try again." : 'Developing…'}</span>
          )}
        </div>
        <figcaption>{item.question}</figcaption>
      </figure>

      {entry ? (
        <SolvedNote entry={entry} onNext={nextUnsolved() >= 0 ? () => setPos(nextUnsolved()) : null} />
      ) : (
        <>
          <GuessForm id={item.id} locks={item.locks} onSolved={(p) => markSolved(item.id, { answer: p.answer, note: p.note })} />
          <Hints
            hints={item.hints}
            shown={hintsShown}
            onReveal={() =>
              setPuzzleData('photos', (d) => {
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
