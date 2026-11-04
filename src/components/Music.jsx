// Background music from a YouTube playlist.
// The YouTube player itself is invisible and can't be tapped; Chelsea uses our own
// controls instead: a small round button that opens a mini player with previous,
// rewind 10s, play/pause, forward 10s, next and volume.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from '../lib/session.jsx';

const MusicContext = createContext(null);
const VOLUME_KEY = 'chelseadle:volume';
const SKIP_SECONDS = 10;

// iPhones and iPads ignore volume changes from web pages (only the hardware buttons work).
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!loadYouTubeApi.promise) {
    loadYouTubeApi.promise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => reject(new Error('YouTube player could not load'));
      document.head.appendChild(s);
    });
  }
  return loadYouTubeApi.promise;
}

function savedVolume() {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v > 0 && v <= 100 ? v : 70;
  } catch {
    return 70;
  }
}

const clock = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export function MusicProvider({ route, children }) {
  const { content } = useSession();
  const playlist = content.music?.playlist;
  const host = useRef(null);
  const player = useRef(null);
  const errors = useRef(0);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false); // waiting for a tap to start (or unmute)
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [volume, setVolumeState] = useState(savedVolume);
  const [time, setTime] = useState({ now: 0, total: 0 });

  useEffect(() => {
    if (!playlist) return;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host.current) return;
        player.current = new YT.Player(host.current, {
          width: 200,
          height: 200,
          playerVars: {
            listType: 'playlist',
            list: playlist,
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (e) => {
              const p = e.target;
              p.setVolume(savedVolume());
              p.playVideo();
              // Browsers may block sound until she taps something. Fall back to starting
              // muted (which is always allowed) and turn the sound on at her first tap.
              setTimeout(() => {
                const s = p.getPlayerState?.();
                if (s !== YT.PlayerState.PLAYING && s !== YT.PlayerState.BUFFERING) {
                  p.mute();
                  p.playVideo();
                  setNeedsTap(true);
                }
              }, 1500);
            },
            onStateChange: (e) => {
              const isPlaying = e.data === YT.PlayerState.PLAYING;
              setPlaying(isPlaying);
              if (isPlaying) errors.current = 0;
              const t = e.target.getVideoData?.()?.title;
              if (t) setTitle(t);
            },
            onError: (e) => {
              // 101/150: the owner doesn't allow this video on other sites. Skip it.
              errors.current += 1;
              if (errors.current > 25 || e.data === 2) {
                setFailed(true);
                return;
              }
              e.target.nextVideo();
            },
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [playlist]);

  // On a puzzle page the open player would cover the keyboard, so tuck it away.
  useEffect(() => {
    if (route) setExpanded(false);
  }, [route]);

  // If sound was blocked, unmute and play on her next tap anywhere.
  useEffect(() => {
    if (!needsTap) return;
    const start = () => {
      const p = player.current;
      if (!p) return;
      p.unMute?.();
      p.setVolume?.(volume);
      p.playVideo?.();
      setNeedsTap(false);
    };
    document.addEventListener('pointerdown', start, { once: true, capture: true });
    return () => document.removeEventListener('pointerdown', start, { capture: true });
  }, [needsTap, volume]);

  // Keep the time readout fresh while the player is open.
  useEffect(() => {
    if (!expanded) return;
    const tick = () => {
      const p = player.current;
      if (p?.getCurrentTime) setTime({ now: p.getCurrentTime() || 0, total: p.getDuration?.() || 0 });
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [expanded, title]);

  const toggle = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else {
      p.unMute?.();
      p.playVideo();
    }
  }, [playing]);

  const skip = (delta) => () => {
    const p = player.current;
    if (!p?.getCurrentTime) return;
    const total = p.getDuration?.() || Infinity;
    const to = Math.min(Math.max(0, p.getCurrentTime() + delta), total - 1);
    p.seekTo(to, true);
    setTime({ now: to, total: p.getDuration?.() || 0 });
  };

  const setVolume = (v) => {
    setVolumeState(v);
    const p = player.current;
    if (p) {
      p.setVolume(v);
      if (v > 0) p.unMute?.();
    }
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {}
  };

  const value = {
    enabled: !!playlist && !failed,
    playing,
    needsTap,
    expanded,
    title,
    open: () => setExpanded(true),
  };

  const progress = time.total ? Math.min(100, (time.now / time.total) * 100) : 0;

  return (
    <MusicContext.Provider value={value}>
      {children}
      {playlist && !failed && (
        <>
          {/* The real YouTube player: invisible and not clickable. */}
          <div className="music-engine" aria-hidden="true">
            <div ref={host} />
          </div>

          {expanded && (
            <section className="music" aria-label="Music player">
              <div className="music-head">
                <p className="music-title" title={title}>
                  {needsTap ? 'Tap anywhere for sound' : title || 'Loading…'}
                </p>
                <button type="button" className="music-icon-btn" onClick={() => setExpanded(false)} aria-label="Minimise player">
                  <MinIcon />
                </button>
              </div>

              <div className="music-progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="music-time">
                <span>{clock(time.now)}</span>
                <span>{clock(time.total)}</span>
              </div>

              <div className="music-controls">
                <button type="button" onClick={() => player.current?.previousVideo?.()} aria-label="Previous song">
                  <PrevIcon />
                </button>
                <button type="button" onClick={skip(-SKIP_SECONDS)} aria-label={`Rewind ${SKIP_SECONDS} seconds`}>
                  <RewindIcon />
                </button>
                <button type="button" className="music-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button type="button" onClick={skip(SKIP_SECONDS)} aria-label={`Forward ${SKIP_SECONDS} seconds`}>
                  <ForwardIcon />
                </button>
                <button type="button" onClick={() => player.current?.nextVideo?.()} aria-label="Next song">
                  <NextIcon />
                </button>
              </div>

              {!IS_IOS && (
                <label className="music-volume">
                  <VolumeIcon level={volume} />
                  <span className="sr-only">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    style={{ '--fill': `${volume}%` }}
                  />
                </label>
              )}
            </section>
          )}

          {!expanded && !route && <MusicButton floating />}
        </>
      )}
    </MusicContext.Provider>
  );
}

/** Small round button that opens the player. Floating on the home page, inline in puzzle headers. */
export function MusicButton({ floating = false }) {
  const m = useContext(MusicContext);
  if (!m?.enabled || m.expanded) return null;
  return (
    <button
      type="button"
      className={`music-btn${floating ? ' is-floating' : ''}${m.needsTap ? ' needs-tap' : ''}`}
      onClick={m.open}
      aria-label={m.playing && m.title ? `Now playing: ${m.title}. Open music player` : 'Open music player'}
    >
      {m.playing && !m.needsTap ? <Bars /> : <NoteIcon />}
    </button>
  );
}

const svg = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'currentColor', 'aria-hidden': true };
const PlayIcon = () => (
  <svg {...svg} width="26" height="26">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg {...svg} width="26" height="26">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
  </svg>
);
const PrevIcon = () => (
  <svg {...svg}>
    <path d="M6 5h2.5v14H6zM19 5.5v13L9.5 12z" />
  </svg>
);
const NextIcon = () => (
  <svg {...svg}>
    <path d="M15.5 5H18v14h-2.5zM5 5.5v13L14.5 12z" />
  </svg>
);
const RewindIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
    <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
      10
    </text>
  </svg>
);
const ForwardIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v4h-4" />
    <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
      10
    </text>
  </svg>
);
const MinIcon = () => (
  <svg {...svg} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const NoteIcon = () => (
  <svg {...svg} width="20" height="20">
    <path d="M10 4.5l10-2v12.2a3 3 0 1 1-2-2.8V6.9l-6 1.2v8.6a3 3 0 1 1-2-2.8z" />
  </svg>
);
const VolumeIcon = ({ level }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    {level > 0 && <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />}
    {level > 50 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
    {level === 0 && <path d="M16 9l5 6M21 9l-5 6" />}
  </svg>
);
const Bars = () => (
  <span className="bars" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);
