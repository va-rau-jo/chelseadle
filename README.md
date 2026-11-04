# Chelseadle

A password-protected birthday puzzle site: a mini crossword, Minute Cryptic-style clues, a photo guessing game and Krillion. Built with React + Vite and hosted free on GitHub Pages.

## How the secrets stay secret

The repo is **public**, so the real puzzles never go into it.

```
content/            <- YOUR PRIVATE SOURCE (git-ignored, lives only on your computer)
  puzzles.json         all questions, answers, hints, messages and the password
  photos/              the photos for Photo Guess
public/data/        <- ENCRYPTED OUTPUT (this is what gets committed and deployed)
```

Running `npm run dev`, `npm run build` or `npm run encrypt` turns `content/` into encrypted files in `public/data/`:

- Everything, photos included, is AES-encrypted with a key derived from the password. Without the password, the site and the repo only contain scrambled bytes.
- Even after unlocking, answers aren't stored anywhere. Each answer is a key that unlocks its own reveal text, so opening the browser dev tools doesn't spoil anything.
- The birthday message (`finale`) can only be decrypted using the answers to every puzzle.

**Back up your `content/` folder** (OneDrive, a USB stick, wherever). It isn't in git, so it's the only copy of your real puzzles.

Also keep commit messages vague ("update puzzles"), since they're public.

## First-time setup

You need [Node.js](https://nodejs.org) 20.19 or newer.

```bash
npm install
npm run dev
```

Open the URL it prints (it also shows a Network URL you can open on your phone if it's on the same Wi-Fi). The example password is `birthday`.

While `npm run dev` is running, saving `content/puzzles.json` or adding a photo re-encrypts and reloads the page automatically.

## Editing the puzzles

Edit `content/puzzles.json`. `content.example/puzzles.json` is a complete example you can always copy from.

Answers ignore capitals, spaces, punctuation and accents, so `"Paris, France"` matches `paris france`. Anywhere you write `"answer": "..."` you can instead write `"answers": ["...", "..."]` to accept several (the first one is shown after solving). `hints` are revealed one at a time.

**Password**

```json
"password": "sunflower",
"passwordHint": "The flower I brought on our first date"
```

The hint is the only thing shown before unlocking. Changing the password makes her log in again but keeps her progress.

**Crossword.** Write the solved grid, one string per row, with `.` for empty squares (`#` works too). Clue numbers are worked out for you, so if a clue is missing or extra, `npm run dev` tells you which. Every run of 2+ letters counts as a word, so words may only touch where they cross. Mostly-empty grids are drawn freeform (no black squares), and classic dense grids get black squares.

```json
"grid": [
  "....I......",
  "..VANCOUVER",
  "..."
],
"across": { "2": "...", "4": "..." },
"down":   { "1": "...", "3": "..." }
```

**Minute Cryptic.** Each clue works like the real Minute Cryptic:

```json
{
  "clue": "Miami plane mixup leads to you",
  "answer": "novia",
  "indicator": "mixup",
  "fodder": "Miami plane",
  "definition": "you",
  "par": 2,
  "explanation": "Plane in Miami is AVION. Mixup means anagram. NOVIA is you!"
}
```

- `indicator`, `fodder` and `definition` are the words highlighted when she picks "show indicators", "show fodder" or "show definition" in the hints menu. Each must appear word for word in the clue, and each can also be a list (for example `"definition": ["Political group's", "celebration"]` for a double definition). Leave one out and that menu item disappears.
- `indicatorExplanation` (optional) is a short note that appears under the clue once she reveals the indicator, e.g. `"“within” is a hidden-word indicator: the answer is spelled out inside the words around it."`
- "show letter" reveals the answer one letter at a time, left to right.
- The row of dots has one dot per possible hint: one for each letter, plus one for each of indicator, fodder and definition. Each hint she uses fills a dot.
- `par` is the position of the "par" marker under the dots, counting from 0. `"par": 0` puts it under the first dot (par is 1 hint), and `"par": 2` puts it under the third (par is 3 hints).
- The letter count, like (3,5), comes from the answer, and `explanation` appears after solving.
- The scribble button opens a scratchpad: she types letters, drags them around to try anagrams, and can shuffle or clear them.
- Note: "show letter" needs the letters in the page, so for cryptic answers they're scrambled rather than fully locked. Someone determined could dig them out with developer tools.

**Photo Guess.** Put photos in `content/photos/` and refer to them by file name. Use .jpg, .png or .webp, because iPhone .heic photos won't display. Photos around 1600px wide load quickly on a phone.

**Krillion.** Each prompt asks her to name something in a category, and rarer answers score more points. It plays as a full-screen vertical dive: every point sinks the krill 10 m deeper past the boat, fish and depth ruler. List the accepted answers under their tier:

```json
{
  "prompt": "Name a fruit",
  "answers": {
    "oneInAKrillion": ["Durian", "Rambutan"],
    "deepCut": ["Lychee", ["Dragon fruit", "Pitaya"]],
    "rare": ["Papaya", "Guava"],
    "schooler": ["Mango", "Pineapple"],
    "plankton": ["Apple", "Banana"]
  }
}
```

- The tiers are One in a Krillion (100, gold), Deep Cut (85, purple), Rare (60, red), Schooler (30, cyan) and Plankton (10, grey). Leave out any tier you don't need.
- An answer can be a list of spellings, for example `["Dragon fruit", "Pitaya"]`. Any of them counts, and the first one is what's shown.
- The start screen doesn't show the first prompt. Each prompt appears only when its timer starts.
- An answer that isn't in the bank shows "Not in the answer bank", and she can try again while time is left. She can also pass for 0 points.
- `"tierText"` sets the line shown under each tier on the reveal screen, for example `"plankton": "Plankton. Everyone thought of that one."`. `"none"` is the line for a pass or when time runs out, and `"tooNiche"` is the line for an answer she claims with "Did I miss one?". Leave a tier out to use the default line.
- `"timeLimit": 100` gives her 100 seconds per prompt, and when time runs out whatever she's typed is submitted. Set it to `0` for no timer. The timer keeps running if she leaves the page mid-prompt.
- The final screen ("The catch") lists each round. Tapping a round opens that prompt's answer list, with tier filters and a search box. The answer list is scrambled rather than fully locked until then, the same as the cryptic letter reveals.
- On a +0 screen (a pass or time running out) she can tap "Did I miss one?" and type the answer she had in mind. It scores +100 as "Too niche for me", with the same gold look as One in a Krillion, and shows up in that round's answer list as her pick.
- `completeMessage` shows on the final screen. Krillion answers don't feed into the finale's lock, so the birthday message unlocks once every prompt has been played.

**Music.** Background music comes from a YouTube playlist:

```json
"music": { "youtubePlaylist": "https://www.youtube.com/playlist?list=PL..." }
```

Paste the link from YouTube's Share button. The playlist must be Public or Unlisted, not Private. Browsers never play sound before the visitor taps something, so the player loads silently on the password page and the music starts the moment she taps Unlock (a wrong password stops it again). On later visits, when she's already logged in, it starts at her first tap anywhere. The playlist ID is stored unencrypted in `meta.json` so the player can load before the password, so don't put anything secret in the playlist's title. A small music button sits in the bottom corner of the home page and in each puzzle's header. Tapping it opens a mini player with the song title, a progress bar, previous, rewind 10s, play/pause, forward 10s, next and a volume slider. The YouTube video itself stays hidden. iPhones don't let web pages change the volume, so the slider is hidden there, and if the phone blocks sound at first, the music starts muted and turns on at her first tap. Some official music videos don't allow embedding on other sites. The player skips those automatically, and the lyric or "Topic" versions of a song usually work instead. Leave `youtubePlaylist` empty to turn music off.

**Chimes.** Every correct answer plays a short bell chime, made in the browser (no sound files): a small one for a crossword word or a Plankton answer, a rising three-note one for a cryptic clue, a photo or a Schooler/Rare answer, and a bigger sparkly one for finishing a whole puzzle, a Deep Cut, a One in a Krillion or a "Too niche" claim. The chimes are in `src/lib/sound.js`. On an iPhone they follow the silent switch.

**Messages.** Each puzzle can have a `completeMessage` that shows once that puzzle is fully solved. `finale` appears on the home page after all four are solved.

Optional: give any item an `"id": "something"`. Progress is saved per question, and by default questions are numbered by position. With an id, a question keeps its saved progress if you reorder the list.

## Publishing on GitHub Pages

One-time setup:

1. Create a new **public** repo on GitHub, e.g. `chelseadle`.
2. In the repo, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. In this folder:
   ```bash
   git init -b main
   git add .
   git status          # check that content/ is NOT listed
   git commit -m "Initial commit"
   git remote add origin https://github.com/<your-username>/chelseadle.git
   git push -u origin main
   ```

Every push to `main` deploys automatically in about a minute. The URL is shown under **Settings > Pages** (`https://<your-username>.github.io/chelseadle/`).

After that, the editing loop is:

```bash
# edit content/puzzles.json, check it with npm run dev, then:
npm run encrypt
git add public/data
git commit -m "Update puzzles"
git push
```

## Testing tips

- On the home page, **Start over** (tap twice) erases progress on that device, so you can play through again.
- Progress and login are saved in the browser, so she can close the tab and pick up where she left off. They're per device, though, so progress on her phone doesn't carry over to her laptop.

## Project layout

```
src/
  App.jsx               password gate, routing, completion unlocks
  components/           home screen, keyboard, shared pieces
  puzzles/              Crossword.jsx, Cryptic.jsx, Photos.jsx, Krillion.jsx
  lib/crypto.js         encryption (shared by the browser and the build script)
  styles.css            all styling; colours are at the top
scripts/build-content.mjs   validates content/ and writes public/data/
.github/workflows/deploy.yml  GitHub Pages deploy
```
