# Sahib Redesign — Progress & Working Notes

**Branch:** `redesign/pc-first` (created from `main` @ `820bf24`, which matches `origin/main`)
**Scope:** PC-first UI/UX redesign, universal theme system, and Awqat Salaat prayer-feature integration.
**Checkpoint rule:** Desktop is finished, tested and reviewed before Android-specific work begins.
**Last updated:** 2026-10-19

---

## 1. Audit summary

### 1.1 Sahib (existing)

| Area | Finding |
| --- | --- |
| Architecture | Vanilla HTML/CSS/JS, no build step, no framework. Scripts loaded in dependency order in `index.html`. |
| Persistence | IndexedDB via `js/db.js` (`adkar-db`, v4) and the `store` facade in `js/store.js`. User data: cats, adkar, favs, counters, meta, local PDFs. |
| Prayer | `js/prayer.js` fetches full months from AlAdhan (method 19, school 0), caches per month, keeps a `prayer-last-good` offline snapshot, prefetches 90 days. `js/views/prayer.js` renders timetable, next-prayer card, Maghrib→Maghrib daily cycle, night thirds, forbidden windows. |
| Location | `js/location.js`: Open-Meteo geocoding + manual coordinates + explicit GPS gesture. GPS is never mandatory. |
| Themes | `js/app.js` + `css/base.css`: Catppuccin Mocha/Latte, five accents (`body[data-accent]`). |
| Service worker | `sw.js` v2.10.68: precached app shell, cache-first same-origin, network-first navigation, `sahib-books` + `sahib-asma-audio` exempt from cleanup. VERSION must be bumped on any js/css/html change. |
| Responsive | `css/responsive.css` is the only authority for responsive overrides. `layout.css` has legacy media rules; no new ones are added there. |
| Verified contracts | `getMonth()` → `{ data, ts, stale }`; `state.js` keeps `item.categories`; no raw `#tag` badges; `sahib-books`/`sahib-asma-audio` cache exemptions. |

### 1.2 Awqat Salaat (reference, cloned and inspected)

Repository: <https://github.com/Khiro95/Awqat-Salaat> — **MIT License, Copyright (c) 2023 Khiro** (LICENSE read in full). PRIVACY-POLICY.md confirms a local-first, no-account desktop app; data stays on the machine.

Reviewed source areas:
- `AwqatSalaat.Common/Data/PrayerTimesService.cs` — providers: `SalahHour`, `AlAdhan`, `Local`, `QCH`, `CSV`.
- `Services/Local/LocalClient.cs` + `LocalRequest.cs` — offline calculation through the **Batoulapps.Adhan** algorithm library, configurable Fajr/Isha angles, Maghrib fixed-minute rule, Shafi/Hanafi madhab.
- `Services/CSV/CsvClient.cs`, `CsvTimes.cs`, `CsvTimesMap.cs` — CSV schedule import with configurable columns (`Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha`, optional `Date, Day, Month`).
- `Configurations/PrayerConfig.cs` — per-prayer visibility, adjustments, reminder offset, elapsed-time notification, adhan sound per prayer, standard/Fajr adhan.
- `Helpers/AdhanConverter.cs` — bundled MP3 recitations for many reciters.
- `CHANGELOG.md` — widget, tray countdown, lock-screen notification, reminders, multi-display; Windows-specific.

### 1.3 Feature decisions for a browser PWA

| Awqat Salaat feature | Sahib decision |
| --- | --- |
| AlAdhan provider | **Keep and improve** (monthly cache, method/school preferences, stale status). |
| Offline local calculation | **Implement** by vendoring Adhan.js (`js/vendor/adhan.js`, MIT, Batoul Apps) and adding a provider interface. Validated against AlAdhan test months (see §7). |
| CSV import | **Implement**, validated, local-only, explicit preview, replace/clear. |
| Next prayer + live countdown | **Implement** with one shared second-resolution ticker, progress, entered-prayer state, Maghrib→Maghrib transitions and next-day Fajr. |
| Home compact widget | **Implement** with the same engine. |
| Hourly SalahHour / QCH scraping | **Not implemented** — browser-unfriendly external scraping, no clear license/terms. Documented limitation. |
| System tray / lock screen / Windows widget | **Not implementable** in a browser PWA; documented as a future native-wrapper enhancement. No fake controls. |
| Bundled recitation MP3s | **Not copied** — individual recitation assets have their own provenance/licensing. A self-hosted synthesized reminder chime is implemented instead, with per-prayer sound toggles and preview. |
| Reminder offsets + elapsed-time notice | **Implement** in-app + optional Web Notifications (permission requested only after an explicit user action). |
| Per-prayer adjustments | **Implement**, applied on top of provider times without mutating caches. |

---

## 2. Implementation plan (PC first)

1. **Design system** — `css/tokens.css` (5 theme families × light/dark, 9 accents, 4 fonts, semantic tokens), `js/theme.js` engine, rewritten `css/base.css`, new `css/design.css` (desktop shell/components), self-hosted Cairo/Inter.
2. **App shell** — desktop sidebar + topbar, active navigation, responsive fallback deferred to Stage 2 in `css/responsive.css`.
3. **Home dashboard** — hero, live next-prayer widget, quick actions, daily cycle, quote.
4. **Prayer module** — provider interface (AlAdhan / offline / CSV), live countdown, timetable, month view, print/export, status/provider indicators, preserved cycle/night-thirds/forbidden logic.
5. **Settings** — Appearance (theme/mode/accent/font), Prayer (provider/method/school/format/adjustments/location/CSV), Alerts (lead time, per-prayer, notification permission, sound preview), Data, About.
6. **All existing modules** — categories, adkar list, detail, session, favorites, Hijri, Asma, Library, Tasbih, reader, forms, modals, toasts, empty states, offline UI.
7. **Service worker** — new assets in the shell list, version bumped, exemptions preserved.
8. **Testing** — syntax checks, headless browser smoke tests at 1200/1440/1920, offline/provider/CSV/countdown tests, regression pass.
9. **Checkpoint** — report + commits. Android pass only after review.

---

## 3. Desktop work log — 2026-10-19

### 3.1 Design system and shell

- Added `css/tokens.css` (SAHIB TOKENS v3.1): Catppuccin, Aura, Dracula, Tokyo Night, Rosé Pine; light/dark palettes; 9 accents; 4 font choices (Tajawal, Cairo, Inter, System); semantic tokens plus legacy bridges (`--bg`, `--surface`, `--accent`, `--text`, etc.). Catppuccin dark + gold + Tajawal remain the defaults. `.light` remains supported for older surfaces.
- Rewrote `css/base.css` around semantic tokens, RTL/Arabic typography, self-hosted Amiri/Tajawal plus new Cairo/Inter faces and OFL licence files.
- Added `js/theme.js`: persisted theme family, mode, accent and font via the store; applies `data-theme`, `data-mode`, `data-accent`, `data-font`, `.light`, updates the theme-color meta, and dispatches `sahib:themechange`.
- Added `css/design.css`: desktop app shell, topbar/sidebar, cards, buttons, forms, modals, widgets, prayer surfaces, settings, home dashboard, Hijri/Asma/Library/Tasbih, adkar grid, detail/session and print styles.
- Restructured `index.html`: fixed sidebar with Home/Adkar/Prayer/Hijri/Names/Library/Tasbih/Search/Settings, topbar, view containers, settings modal with five tabs, script/style order, self-hosted fonts and vendor scripts.
- Hid legacy `.back-bar` at ≥961px (desktop shell replaces it); no responsive rules were added to `layout.css`.
- Fixed icon injection so standalone `.btn-icon[data-icon]` spans (topbar search, modal close buttons, settings controls) receive their SVG; settings-nav stays highlighted while the modal is open and is restored on close.
- Added `js/settings.js` with Appearance, Prayer, Alerts, Data and About tabs, live handlers, storage estimate, backup/import actions and prayer UI refresh.

### 3.2 Prayer engine and widgets

- Rebuilt `js/prayer.js` around provider modes `aladhan` (default), `auto`, `local`, `csv`; per-prayer preferences stored in IndexedDB meta key `prayerPrefs`.
- Cache key: `prayer-{provider}-{method}-{school}-{lat}-{lng}-{year}-{month}`. Legacy month keys migrate for AlAdhan method 19/school 0. Last-good snapshot: `prayer-last-good`. CSV schedule: `prayer-csv-schedule`.
- Fallback chain: AlAdhan network → cached AlAdhan month → last-good snapshot → Adhan.js offline calculation, with `source`, `stale`, `fallback`, `online`, `lastError` status exposed through `getPrayerStatus()`.
- Vendored Adhan.js 4.4.3 UMD (`js/vendor/adhan.js`, MIT, Batoul Apps) for offline calculation; default method 19 angles (Fajr 18°, Isha 17°), Shafi/Hanafi madhab, middle-of-night high-latitude rule, nearest rounding. Device timezone must match the selected location; documented in settings.
- Per-prayer adjustments (−60…+60 min) are applied at display/logic time without mutating cached provider data; reset control included.
- CSV parser follows Awqat Salaat `CsvTimes` columns (`Fajr`, `Shuruq`/`Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`, optional `Date`, `Day`, `Month`), validates times/dates, previews rows and replaces only the imported schedule. Importing switches the provider to `csv`; AlAdhan caches are never mixed or overwritten. Export uses the same header for round-trip.
- Added `js/prayer-widget.js`: shared live next-prayer widget (Home hero and Prayer panel variants), second-resolution countdown, progress, “entered” state, per-prayer times, freshness/provider footer, `PrayerAlerts` scheduler, WebAudio three-tone chime, optional browser notifications and notification-click handling. Alerts default off; lead 10 minutes, at-time on, sound/notifications off until explicitly enabled.
- Added month-end handling in the Prayer view: the Maghrib→Maghrib cycle fetches the first day of the following month on demand and re-renders (verified 31 Oct 2026 → 1 Nov 2026). Home/widget already resolved the next day through `getPrayerDay()`.

### 3.3 Home and modules

- Rebuilt Home (`js/views/home.js`): hero with Hijri/Gregorian date, location/event/appearance chips, live prayer widget, real-data stats (Adhkar/Favorites/Library), six feature cards, full-width daily cycle below the dashboard, quote and privacy column.
- Rebuilt the Prayer view (`js/views/prayer.js`): today card/timetable, month overview with adjustment-aware times, province/source/freshness toolbar, month navigation, print, CSV export, settings entry, daily cycle with segment details, forbidden windows and night-thirds, preserved calculation semantics.
- Module sweep and desktop styling for categories, adkar cards/detail/session, favorites, Hijri calendar/events, 99 Names, Library/reader, Tasbih, search, forms, category manager, confirms, toasts, offline UI and modals.
- Desktop adkar grid is 2 columns at 1024–1199 and 3 columns at ≥1200 with full-width tag/group headers; categories use 4 columns ≥1200. Settings modal is 920px wide. Light/dark and RTL checked.

### 3.4 Service worker

- Bumped `sw.js` to **v2.10.68**, added new CSS/JS/vendor/font assets, removed a duplicate `quote.js` entry, and added a `notificationclick` handler that focuses/opens Sahib.
- Cache cleanup continues to preserve `sahib-books` and `sahib-asma-audio`. All 93 local app-shell entries were verified to exist; SW registers, claims clients, serves an offline reload, and caches all shell assets.

---

## 4. Key implementation decisions

- **No new runtime dependencies** beyond the vendored Adhan.js library and self-hosted fonts; no framework, build step or CDN requirement.
- **Privacy unchanged:** no accounts, analytics or cloud sync. Network requests are limited to explicit content/provider actions (AlAdhan, Open-Meteo geocoding, book proxy/audio already shipped). Settings documents this.
- **Notifications:** permission is never requested on load or by saving a preference; only the explicit “Enable browser notifications” button calls `Notification.requestPermission()`. In-app reminder → chime/notification behavior is documented as browser-limited.
- **Alert defaults:** approaching reminders off, lead 10 minutes, at-time on, sound and browser notifications off. Per-prayer sound/reminder toggles and a silent option are included.
- **Reminder sound:** synthesized WebAudio chime (three tones) rather than bundled recitation MP3s, avoiding unlicensed audio redistribution. Preview is available in settings.
- **Cache separation:** CSV schedules are stored separately and never mixed into AlAdhan/offline month caches. Adjustments never mutate provider data.
- **RTL and typography:** Arabic keeps Amiri/Tajawal; UI labels remain English-first with Arabic subtitles where existing content provides them. Legacy `.light` and token aliases are preserved for older components.
- **Layout authority:** `css/responsive.css` remains the sole responsive authority; desktop rules live in `css/design.css`. Back bars are hidden at ≥961px.
- **Offline parity:** Adhan.js output matched AlAdhan on the 2026-10-19 Africa/Algiers test except Asr (15:23 vs 15:25, 2 minutes). This is inherent to library/rounding differences; AlAdhan remains the default and the offline source is labelled.

---

## 5. Files

### Added

- `css/tokens.css`, `css/design.css`
- `js/theme.js`, `js/settings.js`, `js/prayer-widget.js`
- `js/vendor/adhan.js`, `js/vendor/adhan.LICENSE.txt`
- `assets/fonts/Cairo-Variable.woff2`, `Cairo-Latin.woff2`, `Cairo-LatinExt.woff2`, `Inter-Variable.woff2`, `OFL-Cairo.txt`, `OFL-Inter.txt`
- `REDESIGN_PROGRESS.md`

### Modified

- `css/base.css`, `css/responsive.css`
- `index.html`
- `js/app.js`, `js/prayer.js`, `js/views/cats.js`, `js/views/home.js`, `js/views/prayer.js`
- `sw.js`
- `.gitignore` (ignores `.vs/` and local `sahib-context.txt`)

### Preserved / untouched

- All content data, IndexedDB schema, `sahib-books`/`sahib-asma-audio` caches, local PDFs, quotes, Hijri events, Asma data, search index, reader, offline UI and existing user data semantics.

---

## 6. Verification

### Static

- `node --check` on `js/app.js`, `js/prayer.js`, `js/prayer-widget.js`, `js/settings.js`, `js/theme.js`, `js/views/home.js`, `js/views/prayer.js`, `js/views/cats.js`, `sw.js` — all pass.
- UTF-8 sanity check on all edited JS/CSS — no mojibake.
- App-shell audit: 93/93 local sw.js entries exist.

### Headless browser (Edge via Playwright)

Final run: **37/37 checks pass**, no page/console/request errors.

- Boot/shell/Home render, widget countdown and six prayer cells.
- `_pwSchedule` transitions at 04:59, 05:01, 12:11, 15:21, 18:01, 19:31.
- 5 theme families × light/dark, 9 accents, 4 fonts, persistence keys, distinct light/dark backgrounds.
- Settings tabs render; adjustments applied/reset; location row hydration.
- Alerts: lead and at-time chimes fire once, no double fire, notification permission remains `default` unless explicitly requested.
- CSV: actual file-input import, invalid-file rejection, provider switch to `csv`, clear schedule; exported download has correct header and 31 rows + header; own template round-trips.
- Providers: AlAdhan online month, offline fallback (`fallback: true`, source `local`), `auto` offline fallback, month-end next-day fetch.
- Modules: categories, prayer, Hijri (31 cells), Asma (99 cards), Library, Tasbih, favorites, category→adkar (25 cards), detail overlay, global search (26 results).
- Layout: no horizontal overflow at 1200/1440/1920; prayer month table has no overflow; print media rules present.
- Narrow fallback: 960/768/480/390 px no horizontal overflow, sidebar hidden, widget present.
- Additional: settings modal fits at 960/900/768/480; topbar search icon focuses the search input; settings close button works; About GitHub link is a real button; print switches to month and calls `window.print()` once; SW `sahib-v2.10.68` active with controller after reload; offline reload boots Home with widgets.

### Visual review

Screenshots reviewed at 1200/1440/1920 for Home, settings tabs, Prayer today/month, categories, adkar, Hijri, Asma, Library, Tasbih, light mode and Tokyo Night. Screenshots live in the local test folder, not in the repository.

---

## 7. Known limitations / notes

- Browser reminder timers and WebAudio are only reliable while Sahib is open/awake. Background execution, notification delivery and audio are controlled by the OS/browser; this is documented in Alerts settings. No fake tray/lock-screen controls were added.
- Browser notifications require permission and (on many platforms) an installed/open PWA; tapping a reminder focuses/opens Sahib via the service worker.
- Offline calculation requires the device timezone to match the selected location. The Settings → Prayer tab states this explicitly.
- Offline Asr can differ by 1–2 minutes from AlAdhan due to library/rounding differences; users can stay on AlAdhan or accept the offline source.
- Android-specific layout/touch optimization has deliberately **not** started; the <961px fallback remains usable but is not the Stage 2 design.
- `.vs/` (Visual Studio cache) and `sahib-context.txt` (local working notes) are ignored and not shipped.

---

## 8. Git and deployment status

- Branch: `redesign/pc-first` (from `main` @ `820bf24`).
- Desktop checkpoint commit: recorded below after commit.
- Deployment: **not performed.** No production deployment before desktop review, per the checkpoint rule. `main`/GitHub Pages remain unchanged.
- Secrets: none added. No force-push or remote-branch deletion.

---

## 9. Remaining tasks

### Desktop review gate

- [ ] User review of this desktop checkpoint; collect fixes.
- [ ] Resolve any review feedback while keeping responsive rules in `css/responsive.css`.

### Stage 2 — Android (only after desktop approval)

- [ ] Rework the <961px layout for Android: bottom navigation or drawer, frictionless topbar, safe-area insets, touch targets, gestures.
- [ ] Mobile Prayer dashboard, settings sheets, month view and CSV/import flows.
- [ ] Reader/session/Hijri/Asma/Library/Tasbih touch layouts; landscape handling.
- [ ] Performance pass (fonts, widgets, SW cache size), install/update UX, notification/audio background limitations.
- [ ] Re-test at 360/390/412/480/720/960 and real Android Edge/Chrome.
- [ ] Update this document and deploy only after the Android checkpoint is approved.

### Optional follow-ups

- [ ] Document exact AlAdhan/offline Asr parity data in About/help.
- [ ] Consider additional CSV header aliases if real-world schedules require them.
- [ ] Add a formal settings “notification limitations” help link if review asks for it.
