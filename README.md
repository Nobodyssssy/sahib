# Sahib (صاحب)

Sahib is an offline-first, installable Progressive Web App designed as a daily Islamic companion.
It provides fast, private, and readable access to adhkar, prayer times, the Hijri calendar, Names of Allah, a digital tasbih, and a local PDF library with user uploads and selective offline book caching.

The app is built with vanilla HTML, CSS, and JavaScript.
There is no framework and no build step.

## Features

### Adhkar and Hisn al-Muslim

- Full Hisn al-Muslim dataset with v4 taxonomy and visible subcategory UI.
- Current data state:
  - 256 Hisn entries
  - 40 curated seed entries
  - 296 total adhkar on a fresh install
- 22 frozen top-level buckets:
  - nawm
  - wudu
  - masjid
  - salah
  - salah_after
  - sabah
  - masaa
  - duaa
  - rizq
  - dhikr
  - food
  - travel
  - hajj
  - sickness
  - janazah
  - clothing
  - home
  - fear
  - protection
  - weather
  - family
  - manners
  - salawat
- Retired category keys that must never reappear:
  - mutafarriqa
  - cat_100
  - cat_200
  - salah_in
  - istiqaz
  - taam
  - safar
- Every category card has its own icon.
- Inside each bucket:
  - bilingual chip row
  - All chip plus curated subtag chips
  - live count pills on chips
  - empty subtags hidden
  - filtering by bucket:subtag works
- Group headers use curated taxonomy labels instead of raw internal tags.
- Raw tag badges have been removed from:
  - adhkar cards
  - detail modal
  - search results
  - session mode
- Arabic text, English transliteration, hadith references, and virtues where available.
- Versioned auto-merge system:
  - updates are seeded from `js/hisn-data.js`
  - duplicates are detected using normalized Arabic text plus repeat count
  - personal counters and favorites are preserved
  - v4 multi-category rows are preserved during merge
- Hisn 92 and Hisn 93 are separate entries:
  - Hisn 92: repeat 10, categories sabah and masaa
  - Hisn 93: repeat 100, category sabah
  - dedupe key is normalized Arabic plus repeat count, not just normalized Arabic
- Session mode:
  - focused dhikr completion flow
  - resume from live counters
  - progress tracking
  - done-state visual feedback
- Adhkar detail modal:
  - Arabic shown by default inside a bordered shell
  - English transliteration behind an AR/EN toggle
  - Source and Virtue collapsed by default into one "Source & Virtue" fold
  - Fold state does not persist across modal opens
- Session overlay:
  - Same AR/EN toggle as the detail modal
  - Same single "Source & Virtue" fold
  - Session back button goes to the previous dhikr when not on the first item
- Adhkar cards:
  - Arabic only on the card, no transliteration
  - Mobile layout: content row on top, actions and completion ring on one row beneath
  - Edit and delete buttons are dimmed by default, brighten on card hover
- Adhkar detail modal progressive disclosure is live as of v2.10.42.

- Morning/evening dual-wording split (Hisn 77, 80, 81, 89, 90):
  - Each of the five entries has a sabah copy with the morning wording
    and a masaa copy with the evening wording.
  - Sabah bucket: 25 entries.
  - Masaa bucket: 22 entries.
- Sabah seed dedupe:
  - Seed ids 103 and 104 were removed from `js/data-defaults.js`.
  - Their Hisn counterparts (87 and 88) are the surviving entries.
  - The Abu Dawud 5072 / al-Tirmidhi 3389 citation from seed 103 was
    merged into Hisn 87 before the seed line was deleted.
- Existing installs are migrated by a one-time cleanup keyed on meta
  `hisnCleanupV1` in `js/state.js`.
- Reference for verifying Arabic against Hisn al-Muslim:
  https://surahquran.com/Dua-and-Dhikr.html
  and its per-section pages (Morning, Evening, etc.).
  Do not auto-scrape. Use it manually to confirm any Arabic you write
  into `js/hisn-data.js`.
  
### Desktop Almanac Shell

- PC-first redesign using the hand-bound almanac direction: dated masthead, ruled sections, a reading page, a quiet index and a daybook.
- Fixed desktop sidebar and topbar with English/Arabic navigation labels and a collapsible sidebar.
- Semantic token system in `css/tokens.css`:
  - five theme families: Catppuccin, Aura, Dracula, Tokyo Night, Rosé Pine
  - light and dark modes for each
  - nine accents
  - four typefaces: Tajawal, Cairo, Inter, System
- Persisted appearance preferences via `js/theme.js`.
- Settings modal with Appearance, Prayer, Alerts, Data and About tabs.
- Daily Practice daybook (`js/views/practice.js`) with Today, Upcoming, Calendar and All Practices.
- Responsive overrides remain in `css/responsive.css`; desktop composition lives in `css/design.css`.

### Prayer Times and Daily Cycle

- Prayer times through the Aladhan API.
- Provider modes: AlAdhan (default), automatic fallback, offline Adhan.js calculation and validated CSV schedules.
- Per-prayer adjustments and live next-prayer countdown.
- Location support with GPS or manual city selection.
- Monthly prayer data is cached locally.
- Reminders:
  - approaching and at-time alerts
  - per-prayer toggles, quiet hours and lead time in Settings
  - synthesized chime or bundled adhan recordings
  - optional browser notifications, requested only after an explicit user action
- Offline fallback:
  - the last successful prayer month is stored under `prayer-last-good`
  - when the network fails, the app serves the snapshot with a stale flag
  - the prayer view shows an updated pill:
    - online: `Updated Xm ago`
    - offline: `Offline · last update DD/MM HH:MM (Xd ago)`
- Visual daily cycle bar from Maghrib to Maghrib.
- Highlights:
  - night
  - last third of the night
  - day
  - forbidden prayer times
- Source-linked panels for relevant rulings.

### Hijri Calendar

- Hijri date display.
- Islamic events and recommended observances.
- Type-driven SVG icons for event categories.
- Works offline using inline event data and `Intl.DateTimeFormat`.
- Hijri events are stored in js/hijri-events.js and rendered from inline data only. No network calls.

### Names of Allah

- Asma ul-Husna view with flashcard study mode. Inline data, fully offline.
- Per-name detail data in `js/asma-data.js`:
  - `about` - English scholarly paragraph from islamtics.com, 99/99 populated
  - `aboutAr` - Arabic translation of `about`, 99/99 populated
  - `tafsirAr` / `tafsirEn` - short meaning paragraph per name
  - `quran` - array of `{ surah, ayah, arabic, translation }`
- Detail modal, opened by tapping a card:
  - Hero block: Arabic name, transliteration, English meaning, per-name audio play button
  - Meaning section: `tafsirAr` or `tafsirEn` per modal language
  - Collapsed "More info" fold, collapsed by default, resets on every open:
    - About: `aboutAr` in Arabic mode, `about` in English mode
    - In the Quran: each verse with Arabic text, translation, and `Surah : ayah` reference
  - Inline AR/EN toggle in the modal title bar
  - Direction follows modal language: Arabic mode RTL right-aligned, English mode LTR left-aligned
- Arabic `aboutAr`, `tafsirAr`, and Quran verse Arabic render bold (Amiri Bold).
- Audio: 99 pronunciation clips at `assets/asma-audio/{id}_{name}.mp3`.
  - `assets/asma-audio/index.json` maps `id` to filename, precached with the app shell.
  - Play button inside the detail modal only, not on grid cards.
  - Audio stops and resets on modal close. One shared `Audio` element.
  - Cached in a dedicated `sahib-asma-audio` bucket, cache-first, runtime-cached on first play, exempt from activate cleanup.
- Reference for verification:
  - https://islamtics.com/99-names-of-allah-al-asma-ul-husna/
  - Per-name page example: https://islamtics.com/99-names-of-allah-al-asma-ul-husna/ar-rahman-1/
  - Do not scrape. Use it manually to confirm any Arabic before writing it into `js/asma-data.js`.
- English meanings are intentionally kept as the app's existing wording, not islamtics wording. 76 of 99 differ by word choice; the app wording was reviewed and kept.
- Known data residuals:
  - `aboutAr` is not fully vocalized with tashkeel. Deferred, see Roadmap.
  - Some `aboutAr` strings contain guillemets inside Arabic sentences. Deferred cleanup, see Roadmap.
- Known data residuals:
  - `aboutAr` is not fully vocalized with tashkeel. Deferred, see Roadmap.
  - Some `aboutAr` strings contain guillemets `«»` inside Arabic sentences. Deferred cleanup, see Roadmap.
  
### Library and Reader

- Curated 70-book library served from the private `sahib-assets` repository through the Cloudflare Worker proxy. The app no longer ships `assets/books`.
- Nine category folders, 70 books total:
  1. Quran and Its Sciences (5)
  2. Hadith and Its Sciences (9)
  3. Prophet's Biography and History (6)
  4. Islamic Creed and Theology (12)
  5. Islamic Jurisprudence and Usul (7)
  6. Purification of the Soul and Adhkar (14)
  7. Modern Studies and Issues (7)
  8. General Books and Literature (5)
  9. Companions and Caliphs (5)
- Beginner path banner on library landing:
  - ten curated books in reading order
  - per-book notes in Arabic and English
  - notes render after cover generation
- Local PDF uploads:
  - upload any PDF from device into IndexedDB
  - stored in the `local_books` object store
  - size limits:
    - 500 MB per file allowed
    - 900 MB warning threshold
    - approximately 1.2 GB refuse ceiling
  - generated page-1 cover thumbnails cached locally
  - edit title, author, and description in Arabic and English
  - delete single book or delete all uploaded books
  - merged into search, category counts, detail modal, and reader
  - already offline because blobs live in IndexedDB
- Offline book cache:
  - five small beginner-path PDFs are auto-precached on service worker install
  - approximate auto-precached size: 14 MB
  - auto-precached books:
    - Jazariyyah
    - Kitab al-Tawhid
    - Ma La Yasa al-Muslim Jahl
    - Manhaj al-Salikin
    - Hisn al-Muslim
  - five heavy beginner-path PDFs can be downloaded on demand
  - the whole library can be downloaded on demand from the Library download modal
  - cached books are stored in a dedicated `sahib-books` cache
  - the `sahib-books` cache is exempt from normal service worker activation cleanup
  - book PDF requests are served cache-first when available
  - Range requests pass through to the network
  - outbound source links such as sunnah.com or quran.com are not fetched or cached
- PDF hosting: library PDFs live in the separate private repository
  `Nobodyssssy/sahib-assets`. They are served through a Cloudflare Worker
  proxy at `sahib-proxy.sahib-app.workers.dev` that holds a fine-grained
  GitHub PAT server-side; the token never reaches the browser. The main
  Sahib repo no longer contains `assets/books/`.
- Reader powered by a vendored EmbedPDF PDFium WASM engine:
  - correct Arabic shaping and glyph rendering natively
  - no server-side rasterization
  - no page-image folders
  - no PDF.js
  - no external cmap or standard-font downloads
  - PDFium engine files are precached with the app shell
- Reader zoom:
  - Pinch on touch, Ctrl + wheel on desktop, `+`/`-`/Reset in the settings panel.
  - Zoom grows the page box, not just the raster density; canvas is re-rendered at `scale × devicePixelRatio` so text stays crisp.
  - Zoomed past fit-width, the scroll container gains a horizontal scrollbar; the wrap and canvas are unclamped.
  - Zoom resets to 100% on each reader open.

### Current state (as of v2.10.71)

- `window.HISN_VERSION = 11`.
- `sw.js VERSION = v2.10.71`.
- Desktop almanac shell, five theme families, light/dark modes, nine accents and four typefaces are live.
- Daily Practice daybook is live with a local IndexedDB-backed state.
- Prayer providers: AlAdhan, automatic fallback, offline Adhan.js and CSV.
- Desktop design review completed: `DESIGN_REVIEW.md`.
- Fresh-install adhkar count: 256 Hisn entries, 22 buckets.
- 99 names enriched with `about`, `aboutAr`, `tafsirAr`, `tafsirEn`, `quran`.
- Asma detail modal shipped with progressive disclosure, inline AR/EN toggle, per-name audio with dedicated `sahib-asma-audio` cache.
- Audio cache: `sahib-asma-audio`, cache-first, exempt from activate cleanup.
- Three page rendering modes:
  - Light
  - Dark
  - Sepia
- Page bookmarks:
  - toggle current page
  - bookmark list panel
  - jump to bookmark
  - remove bookmark
  - persisted in IndexedDB
- Header favorites dropdown:
  - favorite adhkar
  - favorite books based on bookmarks or reading progress
  - live count badges
  - precached in the service worker shell
- Continue-reading strip on library landing.
- Reading progress persisted in IndexedDB.
- Reader close button pops the history entry; browser back closes the reader.

### Library Download UI

- Small accent-bordered download button on the Library landing header.
- Opens a modal with:
  - cached book count
  - cached size in MB
  - origin quota remaining
  - Beginner path job
  - Whole library job
  - live progress
  - Cancel
  - Clear cached books
- Downloaded state uses a solid Catppuccin Mocha green pill with dark text.
- Quota errors are toasted distinctly from network errors.
- The storage label is intentionally called `Origin quota remaining`, not free disk space.

### Digital Tasbih

- Tactile counter interface with a growing ring around an Arabic dhikr.
- Plus tap increments count toward target.
- Minus button decrements count, never below zero.
- Reset button returns count to zero.
- Editable count: tap the counter number in the ring to enter a specific value inline. Enter confirms, Escape cancels.
- Settings gear (top-right of the ring) opens a modal with:
  - Dhikr presets: eight curated dhikr chips in Arabic (سُبْحَانَ اللَّهِ وَبِحَمْدِهِ, سُبْحَانَ اللَّهِ الْعَظِيمِ, etc.).
  - Target chips: 33, 99, 100, plus a custom target input.
  - Color swatches: theme, peach, green, mauve, teal, blue.
  - OK button confirms and closes.
- Selected chip uses a solid accent block with a glow ring for immediate feedback.
- Visual growth:
  - The progress ring grows in scale as count approaches target.
  - The dhikr text scales proportionally.
  - The tier is chosen by the target: 33 or less (small), up to 100 (medium), up to 1000 (large).
  - Target and count in the center remain the visual anchor.
- Completion feedback:
  - When the target is reached, the progress ring turns Catppuccin green.
  - A pill with مكتمل shows below the ring.
  - Does not cover the counter or tap area.
- Persistence:
  - State stored under the `tasbih` meta key.
  - Fields: `presetIndex`, `selectedDhikrId`, `target`, `customTarget`, `count`, `color`.
- Fully offline.
- The tasbih view itself makes no direct fetch, HTTP, localStorage, or IndexedDB calls. Persistence goes through `store`.

### Search

- Fuzzy search across adhkar.
- Filters by category, reliability, tag, and favorites.
- Search bar visible on category and search views.
- Library search covers curated books and local uploaded books.

### Themes

- Dark and light modes based on Catppuccin Mocha and Latte.
- Five accent variants:
  - gold
  - peach
  - blue
  - green
  - mauve
- CSS-variable driven theming.
- SVG sprite icon system, no emoji-dependent UI rendering.

### Scroll and Navigation

- Floating scroll-to-top button appears after 300px of scroll.
- Hidden while the session overlay or reader overlay is open.
- Browser back button (Chrome/Edge desktop Alt+Left, Android system back) closes
  the current pushed view: adhkar list, detail modal, session overlay, reader,
  favorites adkar view. Top-level tabs (Home, Prayer, Hijri, Asma, Library,
  Tasbih) do not push history entries.
- Adhkar categories render in a fixed display order:
  sabah, masaa, nawm, salah, salah_after, wudu, masjid, food, travel, hajj,
  sickness, janazah, clothing, home, duaa, dhikr, aam.
- Category grid: 2 columns at 480px and below, 3 columns from 481 to 1199,
  4 columns at 1200 and above.
- `css/responsive.css` is the single authority for mobile layout overrides.
  Do not add responsive rules to `layout.css`; they lose the cascade.
### Offline and Privacy

- Service worker caching for offline use.
- App shell is precached and served cache-first.
- All user data stored locally in IndexedDB.
- No accounts.
- No tracking.
- No cloud sync.
- Uploaded PDFs never leave the device.
- Book PDFs are only cached when auto-precached or explicitly downloaded by the user.
- External source links are not prefetched.

## Tech Stack

- Frontend: vanilla JavaScript ES6+, HTML5, CSS3.
- Styling: custom CSS variables, Catppuccin-inspired palette.
- Storage: IndexedDB through a small custom wrapper.
- Database version: v4.
- Object stores:
  - cats
  - adkar
  - favs
  - counters
  - meta
  - local_books
- Migration: automatic one-time migration from older localStorage data.
- Offline:
  - service worker with cache-first app shell
  - dedicated `sahib-books` cache for PDFs
  - prayer month snapshot fallback
  - selective beginner PDF precaching
- Fonts: self-hosted Amiri for Arabic and Tajawal for UI.
- Icons: Lucide-style SVG sprite in `assets/icons/sprite.svg`.
- PDF rendering: EmbedPDF, PDFium compiled to WASM, vendored under `js/vendor/` and tracked in git.
- Local uploads: Blob URLs served from IndexedDB `local_books` object store.
- Auto-precache of five small beginner PDFs on service worker install (~14 MB).
- Library download modal for on-demand caching of the beginner path or the whole library.


## Packaging and Distribution

The web app is the source of truth. Native wrappers are generated from the live
PWA URL and distributed via GitHub Releases only. No app stores.

- Windows: PakePlus cloud build produces `Sahib_1.0.0_x64-setup.exe` and
  `Sahib_1.0.0_x64_en-US.msi`. Tauri-based. Roughly 4 to 6 MB each.
- Android: PakePlus cloud build produces `Sahib_1.0.0.apk`. Not yet built.
  Target Android 7.0+.
- iOS: PakePlus cloud build produces an unsigned IPA. Not yet built.
  Target iOS 15.6+. Users install via AltStore, SideStore, or Sideloadly.
  Apple Developer Program membership ($99/year) is required for a signed
  IPA that does not need weekly re-signing.

All three wrappers load `https://nobodyssssy.github.io/adkar/` in a native shell
and inherit the Worker proxy for PDF fetching. They do not bundle the PDFs.

PakePlus free tier: 3 cloud builds per 24 hours.

Distribution: attach the built files to a release at
`https://github.com/Nobodyssssy/adkar/releases`.

When built, the Windows `.exe` and `.msi`, Android `.apk`, and unsigned iOS
`.ipa` will be attached to a GitHub Release and linked from this README under
a Downloads heading. Users install directly from the release page. The
wrappers load the live GitHub Pages URL and inherit the Worker proxy for PDF
fetching.

Status:
- Windows: not yet built.
- Android APK: not yet built.
- iOS IPA: not yet built.
- All three: not yet uploaded to Releases.

## Data Merge Model

Sahib uses a deterministic, versioned merge system.

- Core seed data lives in `js/data-defaults.js`.
- Hisn al-Muslim data lives in `js/hisn-data.js`.
- Taxonomy labels live in `js/adhkar-taxonomy.js`.
- On boot, `js/state.js` compares local `hisnMergedV2` meta against `window.HISN_VERSION`.
- Current Hisn version: 5.
- If the dataset version is newer:
  - new entries are merged into IndexedDB
  - duplicate Arabic text is skipped
  - duplicate detection uses normalized Arabic text plus repeat count
  - v4 `categories` arrays are preserved
  - ids are assigned from the current maximum id
  - user counters and favorites remain untouched
- Category icons are resynced on boot from `defaultCats()` when missing.
- This resync is idempotent.

The dedupe key change prevents Hisn 92 and Hisn 93 from being collapsed again after future version bumps.

To update Hisn data:

1. Edit `js/hisn-data.js`.
2. Bump `window.HISN_VERSION`.
3. Bump the service worker version in `sw.js`.
4. Clear site data and hard reload.

For bulk retagging or large data authoring:

- Do not ask a chat LLM to rewrite hundreds of entries directly.
- Use a local deterministic script.
- Produce an audit table first.
- Apply mechanically.
- Delete the one-off script after use.

## Offline Book Cache Model

The offline book system is intentionally selective.

- `js/offline-books.js` exposes `window.OFFLINE_BOOKS`.
- It owns:
  - the `sahib-books` cache name
  - URL tables for beginner-path PDFs
  - `offlineBookUrl(id)`
  - `isBookCached(id)`
  - `listCachedBookIds()`
  - `cacheBookById(id, signal)`
  - `cacheBeginnerBooks()`
  - `clearOfflineBooks()`
- `sw.js`:
  - precaches the app shell
  - then auto-fetches the five small beginner PDFs
  - auto-precache failures are logged, not fatal
  - serves book PDFs cache-first from `sahib-books`
  - passes Range requests through
  - exempts `sahib-books` from activate cleanup
  - evicts old versioned app-shell caches on activate
- `js/offline-ui.js` exposes `window.OFFLINE_UI`.
- It owns the Library download modal:
  - open
  - close
  - start mode
  - cancel
  - clear
- The Library landing header button opens the modal.
- The modal shows honest storage information:
  - cached book count
  - cached size
  - origin quota remaining
- Do not label `navigator.storage.estimate().quota` as free disk space.
- It is the per-origin quota, typically around 10 GB on Chromium.


### Cloudflare Worker Proxy

PDF fetching goes through a Cloudflare Worker, not directly to GitHub.

- Worker name: `sahib-proxy`
- Worker URL: `https://sahib-proxy.sahib-app.workers.dev`
- Worker source repo (private): `Nobodyssssy/sahib-proxy`
- Local source: `E:\sahib-proxy\src\index.js`
- Secret name: `GITHUB_TOKEN` (fine-grained PAT, Contents: Read-only)
- Secret scope: only `Nobodyssssy/sahib-assets`
- Secret expiry: 2027-01-07. Rotate with `wrangler secret put GITHUB_TOKEN`.
- The Worker uses `api.github.com/repos/Nobodyssssy/sahib-assets/contents/<path>`
  with `Accept: application/vnd.github.v3.raw` to stream raw file bytes.
- CORS headers are added so the browser can fetch cross-origin.
- The token never reaches the client. Client code only knows the Worker URL.
- Do not bypass the Worker. Do not call `api.github.com` or
  `raw.githubusercontent.com` directly from the app.
  
## Asma Audio Cache Model

The 99 pronunciation clips are cached separately from the app shell.

- `assets/asma-audio/{id}_{name}.mp3` - 99 files.
- `assets/asma-audio/index.json` - id-to-filename map, precached in `APP_SHELL`.
- `sahib-asma-audio` - dedicated Cache Storage bucket owned by `sw.js`.
- Cache-first for `*.mp3` requests whose path contains `/assets/asma-audio/`.
- Exempt from activate cleanup, parallel to `sahib-books`.
- Runtime-cached only. Never precached. 99 files would bloat install.
- Asma mp3 handler runs BEFORE the Range short-circuit in the fetch handler.
  `<audio>` sends `Range: bytes=0-` on every load. If Range passed first, the
  mp3 would never be cached. The handler rebuilds a clean Request (no Range),
  caches the full 200 response, and the browser slices it client-side.
- Uses `includes()` not `startsWith()` on the path check. On GitHub Pages the
  site is served under the `/adkar/` subpath, so `pathname` is
  `/adkar/assets/asma-audio/x.mp3`. `startsWith('/assets/...')` silently
  bypassed the SW on prod; `includes('/assets/...')` catches both.

Playback lifecycle in `js/views/asma.js`:

- One shared `Audio` element per session, created lazily on first play.
- `play`, `playing`, `pause`, `ended` events drive `_asmaIsPlaying` and the
  button state. Not polled from `currentTime`.
- Button state keyed on `_asmaAudioId` so a stale element cannot light the
  wrong name.
- On modal close: `pause()`, `currentTime = 0`, `removeAttribute('src')`,
  `load()`. No leaked stream.
- Opening a different name while another plays: old pauses and resets before
  the new `src` is assigned.

Do not:

- Precache the 99 mp3s in `APP_SHELL`.
- Put mp3s in the versioned `sahib-vX.Y.Z` cache.
- Remove `sahib-asma-audio` from the activate exemption.

## Prayer Offline Snapshot Model

Prayer times now degrade gracefully offline.

- `js/prayer.js`:
  - `_rememberLastGoodMonth()` stores the last successful month under `prayer-last-good`
  - `_loadLastGoodMonth()` reads it back
  - `fetchMonth()` snapshots successful responses
  - `getToday()` and `getMonth()` catch network errors and fall back to the snapshot
  - fallback responses are marked `stale: true`
- `getMonth()` now returns `{ data, ts, stale }`.
- All callers must handle that shape.
- `js/views/prayer.js`:
  - renders a `.prayer-updated` pill under the location line
  - uses `_formatAgo()` and `_formatStamp()`
  - shows online freshness or offline stale timing
  - duplicate pill rendering was removed

## Local Development

Clone the repository.

Start a local server. The app requires a server for service worker registration and PDF/font handling.

```cmd
cd /d E:\Sahib
python start.py
```

Then open:

```text
http://localhost:5500
```

For production testing, deploy the `main` branch to GitHub Pages.

## Repository Hygiene

Git history was rewritten once to purge removed raster JPEG folders from past commits.
PDF assets were moved out of this repository in commit 241fd03. The 70 PDFs now
live in the private repo `Nobodyssssy/sahib-assets` and are served through the
Cloudflare Worker proxy `sahib-proxy`. The main Sahib repository working tree is
now under 50 MB.

Note: GitHub's own repo size metric does not shrink immediately after removing
large files. The PDFs remain reachable in git history until GitHub's garbage
collection runs on its own schedule. A second `git filter-repo` pass is NOT
planned. Small app packages (APK/MSIX/IPA) are built from the working tree, not
from git history, so this has no effect on distribution size.

Current known debt:

- `.continue-pin-badge` CSS rule in `css/views/books.css` is dead code after the pin system removal.
- Beginner banner arrow may render empty if `chevron-left` is missing from the sprite.
- Local book editing currently uses native `prompt()` dialogs.
- Temporary adhkar backup files are still on disk but gitignored:
  - `*.pre-v3`
  - `*.v3bak`

They should be deleted manually after confirming stability.

## Current Roadmap
Offline core (shell precache, prayer snapshot, sahib-books cache, five beginner PDFs auto-precached, download modal, honest quota label) is shipped as of v2.10.30.

1. ~~Per-book download button: badge and button on each book card, uses existing OFFLINE_BOOKS.cacheBookById~~ ✅ Shipped — download icon on grid cards and in the detail modal; icon updates to a checkmark in both places after caching; offline modal counter scans the real Cache Storage bucket and reflects the true cached count.
2. Offline indicator pill:
   - small Online/Offline badge in Settings and/or Home
3. Qibla UI:
   - `js/qibla.js` exists and is precached
   - UI entry is currently hidden
4. Settings storage estimate line:
   - show origin quota honestly
5. Adhkar detail modal progressive disclosure:
   - collapse source
   - collapse virtue
   - collapse English transliteration
   - add Arabic/English toggle where appropriate
6. RTL directional audit:
   - wrong-way back arrows
   - chevrons
   - prayer table orientation
   - directional icon flipping rules
7. Contrast and readability pass:
   - low-contrast gray text on dark navy
   - badges, chips, timeline labels, focus rings
8. Modal ergonomics and consistency pass:
   - Cancel/Save ordering
   - mobile 48px touch targets
   - fixed buttons clipping badges/tags
   - cramped modal controls
9. Card action and density pass:
   - edit/delete accidental taps
   - overly prominent card actions
   - card height inflation
   - compact mobile category grids
10. Desktop layout balance pass:
   - centered max-width around 1200px
   - sparse Tasbih and Asma layouts
   - category grid spacing versus dashboard
11. Timeline legibility pass:
   - overlapping labels
   - unreadable timestamps
   - narrow-screen prayer/Hijri timeline clipping
12. Visual icon consistency pass:
   - category icon colors versus dashboard gold-outlined style
13. Mobile Tasbih ergonomics pass:
   - settings gear too close to counter ring
14. Bottom navigation bar.
15. Adhkar v4.1 data refinement:
   - Hajj/Umrah split
   - dhikr/tahlil refinement
16. Cross-cutting tag filter axis:
   - frequency
   - context
   - length
17. AR/EN i18n pass, always last.
18. Aria-label sweep on remaining icon-only buttons.
19. Destructive-action copy fixes.
20. Settings import/export visual hierarchy.
21. Empty-state audit.
22. Attribution footer verification.
23. Dead-code sweep and `.adkar-grid` consolidation.
24. ~~Tasbih enhancements~~ ✅ Shipped as of v2.10.47 — minus, reset, editable count, dhikr presets, target chips, color swatches, growing ring, green completion state.
25. ~~Asma detail modal + per-name audio~~ ✅ Shipped as of v2.10.65 — progressive disclosure, inline AR/EN toggle, per-name audio with dedicated runtime cache, RTL/LTR alignment fix, pause and chevron-down sprite icons.
26. Asma data refinement (deferred, deterministic pass only):
   - Add full tashkeel to `aboutAr`, sourced from a verified vocalized text
     (islamtics.com per-name pages or a printed reference). One-off local
     script plus audit TSV. Not chat-authored.
   - Replace guillemets `«»` inside Arabic sentences with plain Arabic text
     or Arabic double quotes, per Arabic typography convention for divine
     names.
27. Distribution packaging:
   - Build signed Windows MSI/EXE, Android APK, iOS IPA.
   - Attach to a GitHub Release.
   - Add a Downloads section to this README that links to the release.

## Project Principles

- Offline-first.
- No build step.
- No framework.
- Arabic-first content.
- Local privacy.
- Incremental, verifiable changes.
- Deterministic data transformations over chat-authored bulk edits.
- Selective offline caching over blind full-library caching.