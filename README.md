# Sahib · صاحب

Sahib is a private, offline-first Islamic daily companion, built with vanilla HTML, CSS and JavaScript. It runs in a browser and can be installed as a Progressive Web App. No frontend build step is required.

## Features

- Adhkar collections, focused sessions, progress and favorites.
- Prayer times with AlAdhan, local Adhan.js calculations, monthly caching, calculation settings, adjustments and CSV timetable tools.
- A Maghrib-to-Maghrib daily cycle with proportional scenery, night thirds, an Islamic-midnight marker and approximate restricted-prayer windows.
- Daily practices and reminders, Hijri calendar, the 99 Names and digital tasbih.
- PDF library, local PDF imports, reading progress and selective offline caching.
- Whole-app metadata search, English/Arabic interface switching, independent content-language controls and right-to-left layouts.
- Six theme families: Sahib, Aura, Dracula, Catppuccin, Rosé Pine and Tokyo Night, with light/dark modes, palette accents and six selectable typefaces.
- Separate standard/Fajr adhan choices, local audio imports, volume, previews and per-prayer alert modes.

## Run locally

From the repository root, run:

```sh
python -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/. Use localhost or HTTPS for service workers and supported browser permissions. For hosting, serve this directory as static files, preserving the relative asset paths. The app's runtime dependencies, including its PDF engine, are vendored. The optional PDF dependency build manifest is in `tools/embedpdf-build/package.json`.

A fresh online visit installs the app shell for offline use. Book PDFs and Names audio use separate on-demand caches. Local imports and preferences stay in browser storage; clearing that storage removes them. No account is required. Prayer-time services, location search and requested remote content still need network access when no suitable cached data exists.

## Audio rights and third-party notices

The Al-Azhar Park, Quseir and Balakong field recordings are CC0. The additional **Sheikh Nasser Al-Qatami standard and Fajr recordings have reserved rights**. Awqat Salaat's upstream notice explicitly reserves the Fajr recording rights to **Sharjah Quran**. No permissive recording license has been identified for the standard file. The upstream MIT software license is not claimed to license either recording. A rights notice is not a grant of redistribution permission.

See [audio provenance and rights notices](assets/adhan/LICENSES.md), including source revision, hashes and the upstream software notice. Third-party libraries, fonts, religious datasets and book materials retain their respective rights. No blanket license for all repository content is asserted.

## Limits and planned platforms

Prayer calculations and the daily-cycle guide follow the chosen timetable. The current restriction overlays use approximate 15-minute sunrise and 5-minute pre-Dhuhr buffers; they are not a complete fiqh-rule profile.

Browser/PWA reminders and audio depend on browser permissions, user interaction and lifecycle. Full adhan playback while the app is closed or suspended is not guaranteed.

Windows 11 and Android native packaging are planned, with Tauri v2 under consideration. Native scheduling, tray/window controls, startup integration and Android home-screen widgets require platform work. They are not implemented by this browser release. No Tauri migration is included here.

## Verification

Run `node tools/verify-release.mjs` for JavaScript syntax, HTML/CSS resource paths, offline-shell consistency, recording hashes and rights-notice checks. `tests/release-audio.js` is an async browser smoke expression for a disposable profile; it changes that test profile's audio choices and checks persistence, source resolution and audio metadata without playback. Do not run it against personal browser data.

For browser smoke tests, use Node.js 22 or newer and a local Chromium/Chrome/Edge installation. Set `CHROME` to its executable path, run the static server, then use:

```sh
node tools/browser-smoke.mjs http://127.0.0.1:8766 smoke.png @tests/app-smoke.js
node tools/browser-smoke.mjs http://127.0.0.1:8766 audio.png @tests/release-audio.js
```

Each run creates a disposable browser profile. Set `MOBILE=1` for a phone viewport; `OFFLINE=1` checks an offline reload and bundled audio. Keep screenshot outputs outside the published source tree.
