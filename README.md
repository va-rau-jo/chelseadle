# Chelseadle

A password-protected birthday puzzle site: a mini crossword, Minute Cryptic-style clues, a photo guessing game and trivia. Built with React + Vite and hosted free on GitHub Pages.

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

**Minute Cryptic.** The letter count, like (3,5), comes from the answer. `definition` is the part of the clue that gets highlighted as the first hint. `explanation` appears after solving.

**Photo Guess.** Put photos in `content/photos/` and refer to them by file name. Use .jpg, .png or .webp, because iPhone .heic photos won't display. Photos around 1600px wide load quickly on a phone.

**Trivia.** Add `"choices": [...]` for multiple choice. Leave it out for a free-text answer.

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
  puzzles/              Crossword.jsx, Cryptic.jsx, Photos.jsx, Trivia.jsx
  lib/crypto.js         encryption (shared by the browser and the build script)
  styles.css            all styling; colours are at the top
scripts/build-content.mjs   validates content/ and writes public/data/
.github/workflows/deploy.yml  GitHub Pages deploy
```
