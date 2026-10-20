# Japanese Course

A small, dependency-free web app for learning Japanese vocabulary:

- **Dictionary** – a Japanese → English word list with search, sortable columns, speech register badges (honorific / casual), text-to-speech and JSON backup.
- **Stroke-order player** – animates the strokes of every kana and kanji in a word.
- **Notebook** – grammar points, sentences, free notes and vector drawings.
- **Romaji suggestions** – type romaji and get hiragana, katakana and kanji spellings.

Everything is stored in your browser's `localStorage`; nothing is sent to a server.

## Running

No build step. Open `index.html` in a browser:

```sh
open index.html
```

or serve the folder (e.g. `python3 -m http.server`) and visit http://localhost:8000. It also works as-is on GitHub Pages.

## Project layout

```
index.html      markup
css/style.css   styles (light + dark theme)
js/strokes.js   stroke data for kana and common kanji (KanjiVG)
js/app.js       application logic
```

## External services

- [Google Fonts](https://fonts.google.com/) – Shippori Mincho, Zen Kaku Gothic New, DM Mono
- [Google Input Tools](https://www.google.com/inputtools/) – kanji suggestions (optional, online only)
- [KanjiVG](https://kanjivg.tagaini.net/) via jsDelivr – stroke data for kanji not bundled in `js/strokes.js`

## Credits

Stroke-order data: [KanjiVG](https://kanjivg.tagaini.net/), © Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
