# Sahib · صاحب

Sahib is a private, offline-first Islamic daily companion, built with vanilla HTML, CSS and JavaScript. It runs in a browser and can be installed as a Progressive Web App. No frontend build step is required.

[Open Sahib](https://nobodyssssy.github.io/sahib/) · [Official repository](https://github.com/Nobodyssssy/sahib) · [Report an issue](https://github.com/Nobodyssssy/sahib/issues)

## Install and deploy

Open the official website online once. In Edge or Chrome, choose **Install Sahib** from the address bar or browser app menu. On a phone, use the browser's **Install app** or **Add to Home Screen** option. Allow the initial offline download to finish before disconnecting. Refresh and manifest shortcuts such as [`?cat=sabah`](https://nobodyssssy.github.io/sahib/?cat=sabah) work under the same `/sahib/` directory; the app does not require server-side route rewrites.

GitHub Pages publishes the `main` branch, repository root, at `https://nobodyssssy.github.io/sahib/`. Manifest launch URLs, scope, icons, service-worker registration and cached assets resolve relative to that directory, so localhost hosting also works. The PDF asset proxy remains `https://sahib-proxy.sahib-app.workers.dev`; a repository path change does not change the Pages origin used for CORS.

The repository rename preserves the `adkar-db` IndexedDB database, local-storage keys and dedicated PDF/audio caches. Browser data belongs to the origin (`https://nobodyssssy.github.io`), not the repository path. Existing installed shortcuts may still point to an old path: install from the official URL and keep browser site data when removing an old shortcut. Do not clear site data to update Sahib. Other browsers, profiles and localhost have separate storage.

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

The Windows Tauri v2 preview adds native scheduling/audio, a system tray, optional startup and a floating prayer widget while sharing this interface. Build it with `npm ci` and `npm run desktop:build`; see [Windows setup, acceptance checks and limitations](docs/WINDOWS.md). The Windows preview workflow tests and packages an unsigned installer with a SHA-256 checksum as a GitHub Actions artifact. The preview is separate from the browser release. Signing and automatic updates are not configured. Android packaging and home-screen widgets remain planned.

Preview 0.2.1 offers a compact taskbar widget with a timetable popover, Windows-style or six Sahib appearances, clearer controls, display/position settings, and daily practice plus tomorrow's fasting prompts. Enable it under Settings → Windows → Widget visibility & placement. It supports one or all taskbar displays, saved manual placement, notification-area avoidance, and a content-sized expanded panel. This overlay does not reserve taskbar space; drag it to avoid taskbar icons. See the [Windows verification report](docs/WINDOWS-0.2.1-VERIFICATION.md) for tested behavior and limits.

## Verification

Run `node tools/verify-release.mjs` for JavaScript syntax, HTML/CSS resource paths, offline-shell consistency, recording hashes and rights-notice checks. `tests/release-audio.js` is an async browser smoke expression for a disposable profile; it changes that test profile's audio choices and checks persistence, source resolution and audio metadata without playback. Do not run it against personal browser data.

For browser smoke tests, use Node.js 22 or newer and a local Chromium/Chrome/Edge installation. Set `CHROME` to its executable path, run the static server, then use:

```sh
node tools/browser-smoke.mjs http://127.0.0.1:8766 smoke.png @tests/app-smoke.js
node tools/browser-smoke.mjs http://127.0.0.1:8766 audio.png @tests/release-audio.js
```

Each run creates a disposable browser profile. Set `MOBILE=1` for a phone viewport; `OFFLINE=1` checks an offline reload and bundled audio. Keep screenshot outputs outside the published source tree.

For deployment checks, run `tests/deployment-smoke.js` against the official URL with `PWA_CHECK=1 OFFLINE=1` set in your shell. This checks resolved manifest/icon paths, service-worker scope, the versioned shell, PDF proxy/reader and storage across offline reload. Browser DevTools checks manifest installability; `PWA_INSTALL=1` additionally attempts installation and launch in the disposable profile where the browser supports that automation. An installability pass alone does not confirm an OS installation.
