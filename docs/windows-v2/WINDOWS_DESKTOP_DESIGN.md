# Sahib Windows — Desktop Design Direction & Handoff (DRAFT for approval)

Status: **design direction approved; first implementation pass done on branch `design/desktop-v2` (see sections 7-8 and `WINDOWS_BUGFIX_PLAN.md`). The backup, installed app, PWA and Android were not modified.** The preview overlay described below has been replaced by `css/desktop-v2.css`.
Baseline: Sahib v0.2.5, source HEAD `b01eae5` (branch `codex/taskbar-shell-identity`), rendered as the web UI in a throwaway browser profile.
Evidence: `shots/iter1` (30 baseline shots: 10 pages x 1280/1920/2560), `shots/iter2|iter3` (overlay previews), `critiques/` (Sol critiques), `overlay/desktop-v2.css` (preview of the proposed CSS).

## 0. What was and was not done

| Item | Status |
|---|---|
| Baseline screenshots, 10 pages x 3 sizes (web render) | Done |
| Independent critic (Sol `gpt-6.1-sol`, medium, screenshots only, fresh context) | Done: directions + 2 critiques |
| Critic score | **6/10 baseline, 6/10 after overlay.** The overlay fixed layout defects but did not change the overall judgement: the structure still needs the changes in section 2. No 7+ is claimed. |
| Real Tauri window, native widget, tray, real DPI 125-200% | **Not tested** (installed app was left untouched) |
| Practice history, PDF reader, 99 Names, Search, Adhkar session screens | **Not reviewed** (need data/interaction; see section 5) |
| Arabic RTL | Home + Adhkar list only, one screenshot each |
| French | Out of scope until English/Arabic are done (your decision) |

## 1. Chosen direction: "Reading Desk" (refines the repo's "Mizan / measured editorial")

Sol was asked cold for three directions and picked its own; the repo's `DESIGN_STRATEGY.md` independently recommended the same family.

- **Reading Desk (chosen):** flat paper workspace, fine 1px rules, text columns; enclosed surfaces only where a task needs a boundary.
- **Daily Ledger (borrow):** table/list rows with keyboard navigation for Adhkar index, monthly prayer table and practice history.
- **Practice Studio (borrow):** keep sessions as a separate focus stage with a persistent Exit control. Sahib already has a session overlay, so this is mostly consistency.

Rejected: Ledger as the whole app (risks making devotion feel administrative), Studio as the whole app (second navigation context).

### Design system (tokens + rules)

| Area | Rule |
|---|---|
| Shell | Flat sidebar 216px (collapsible to icons), full height, 1px right rule, rows 40px / 14px text, selected = solid forest green. No floating card sidebar. |
| Header | One 56px header per page: left-aligned page title (serif). **Remove** the "Sahib / section / subtitle" topbar, the duplicate in-page title and the Back button on top-level pages (keep Back only inside drill-down). |
| Layout | 32px gutters, content origin 32px under the header, working pages use full width (cap text blocks, not pages). Remove the `margin-left:102px` / 1500px centred column on `.view`. |
| Density | List rows 56px (64 with two lines); controls 36px; icon targets >= 32px (24px absolute minimum). |
| Surfaces | Cards only for grouped data. Flat sections + rules elsewhere. Radius: 6px controls, 8px groups, no 20-24px radii. |
| Type | Functional text >= 14px, body 15-16px, metadata 13-14px. Serif (Amiri/Georgia) for page titles and devotional text only. Arabic reading 28-32px, line-height >= 1.7, plain background (no image fade behind text). Keep bundled Tajawal/Amiri. **Do not add new font families** until the licence/provenance review in `DEV_STATE.md` is finished. |
| Colour | Keep forest green `#1f4d3a` (navigation, next prayer) and brown `#7b3f25` (primary action only, one per view). Secondary text `#59645c` or darker (>= 4.5:1). Hierarchy by weight/size, not tints. |
| Focus | 2px `#1f4d3a` outline, 2px offset, on every interactive element, light and dark themes. |
| Motion | Short state transitions only, honour `prefers-reduced-motion`. |
| Remove | Scenic banners on interior pages, glow shadows (8x), repeated glassmorphism (15x), default-radius sprawl (49x), flourish glyphs, icon-in-tinted-square cards, `Inter/Manrope/DM Sans` mixtures (4 hits; pick one UI font). Counts from `scripts/tells.mjs`. |
| Keyboard | `Ctrl+K` search/navigation, `Esc` closes overlays, `/` focuses search, arrow keys in lists, shortcut hints beside commands. Only claim shortcuts that exist (see Tasbih). |
| Neutral completion | No streaks, overdue warnings or celebration (matches `DESIGN_STRATEGY.md`). |

## 2. Verified findings (checked in the running UI/source, not only opinion)

| # | Finding | Evidence | Type |
|---|---|---|---|
| F1 | Prev/Next arrows are reversed in the English UI: "Previous day/month" uses `chevron-right` on the left, "Next" uses `chevron-left` | DOM on Prayer and Hijri: Previous x=379 `icon-chevron-right`, Next `icon-chevron-left` | Bug |
| F2 | Sol saw conflicting prayer times (Fajr 05:41 vs 05:42). **Not a data bug**: "Rhythm of your day" runs Maghrib to Maghrib, so Fajr/Sunrise/Dhuhr/Asr are *tomorrow's* times, unlabelled. Offline `adhan.js` (method 19) matches the timetable within 2 min (Asr 14:40 vs 14:42) | DOM text + `computeLocalMonth` run | Labelling / clarity |
| F3 | Hijri calendar overflowed the viewport at 1080p (today clipped) | baseline shot; fits with 84px rows | Layout |
| F4 | Library at 1920px: category ribbons clipped ("QURAN & ITS SCIENC"), titles wrap one word per line, cover cards tall | baseline shot | Layout |
| F5 | Tasbih has no keyboard counting; count is ~24px by default in `tasbih.css` | `grep`, computed style | Missing feature |
| F6 | Sidebar stays on the **left in Arabic** (baseline too) while content mirrors | computed style `x=0` in RTL | Decision needed |
| F7 | Adhan volume is 2 clicks from Home (Settings > Alerts) but only inside a modal | DOM | OK, discoverability only |
| F8 | Language control offers English / العربية only | screenshot | Matches your scope |
| F9 | Hierarchy: Home leads with a 254px scenic banner; Practice needs ~500px before its first choice; Adhkar cards are 273px tall | measured box sizes | Layout |

## 3. Page-by-page handoff

Format: **Problem -> Design -> Components -> Steps -> Acceptance**. Screenshots = before/after at 1280x720, 1920x1080, 2560x1440, EN + AR. Tests = functional unless stated. Source dir: `css/`, `js/views/`, `index.html`.

**Shell + header** (`.app-sidebar`, `.topbar`, `.back-bar`)
Problem: three stacked titles (topbar, back-bar title, page title); floating card sidebar; 192px/56px rows. Design: flat 216px sidebar, one 56px header, Back only on drill-down. Steps: tokens (`css/tokens.css`) first, then shell, then per-page. Acceptance: one title per page; no horizontal scroll at 1280; sidebar collapse persists; focus ring visible on all nav items. Test: Playwright page-by-page title count == 1.

**Home** (`.garden-*`, `js/views/home.js`)
Problem: scenic hero (254px) outranks daily tasks; five equal brown buttons; reading panels compete. Design: slim (96-120px) scene strip that changes with the prayer phase (section 7); one-line greeting; **next prayer + timetable first**; then today's practices (Morning/Evening/Continue) as compact rows with one primary action; Today's reading and Library/99 Names/Hijri as compact secondary. All essentials above the fold at 1280x720. Acceptance: next prayer and primary adhkar action visible without scrolling at 1280x720; <= 1 primary-filled button per section. Preview: `shots/iter2/home-*`.

**Prayer times** (`js/views/prayer.js`)
Problem: scattered info, three "Monthly" entry points, repeated update notices, reversed arrows (F1), unlabelled next-day times (F2). Design: date + location + method + timetable as one page; Today/Month switch; next prayer with slim accent bar; Month = full-width table with sticky date column; Print/CSV in the toolbar. Rhythm chart: keep and improve per section 8 (Tomorrow label, Now marker). Acceptance: arrows follow reading direction in EN and AR; times in timeline carry date labels; one Monthly entry. Test: DOM assertion on chevron mapping per `dir`.

**Adhkar list** (`.cats-grid`, `js/views/cats.js`)
Problem: 273px cards, names far from actions. Design: 56-64px rows: name, count, today's completion, one quiet outlined Start; edit/delete in a row menu; searchable index; arrow keys + Enter. Max width ~1120px. Acceptance: >= 10 collections visible at 1080p; keyboard-only start of a session. Preview: `shots/iter2/cats-*`.

**Adhkar session** (`session-overlay`, `js/views/session.js`) — *not reviewed visually*
Design: keep the existing >=1024px reading/counter workspace; add persistent Exit control and Esc; Arabic 28-32px; remember translation/source visibility. Needs its own screenshot pass before spec is final.

**Practice + history** (`js/views/practice.js`)
Problem: illustrated hero plus onboarding manifesto before 5 choices; tabs Today/Upcoming/Calendar/All exist but the history/calendar tab was not inspected (empty profile). Design: remove hero; one heading + one sentence + selectable rows + one "Add selected"; for returning users Today = list with completion; Calendar = history, clearly separate from daily reset (links to Bug 5/6 in the bugfix plan; no fabricated history). Acceptance: first choice within 250px of header; history reachable in 1 click from Practice. Open: verify what Calendar/All show with real data.

**Library + PDF reader** (`.library-desktop`, `reader.js`)
Problem: clipped ribbons, tall cards, duplicate "Library" heading. Design: 5+ columns at 1920 (min card 240px), titles 17-18px, covers ~170px, no category ribbons (sidebar already filters), list view option. PDF reader: **no redesign proposed yet**: reader was not reviewed and the PDF engine/IDs/progress must be preserved. Acceptance: no clipped title at 1280/1920/2560. Preview: `shots/iter3/books-*`. Reader audit is a separate task (bugfix Bug 7).

**Tasbih** (`js/views/tasbih.js`)
Problem: 620x660 double-framed panel; count 24px; plus button dominates; settings floats. Design: no frames; count 72-88px tabular; phrase ~32px; plus within 24px of the dial (or dial itself is the target); decrement and reset separated and labelled; settings in the same group. **New feature:** Space/Enter to count (not present today, F5), key-repeat must not auto-increment; then show the hint. Acceptance: count readable at 3 m (>=72px) ; keyboard count tested.

**Hijri calendar** (`js/views/hijri.js`)
Problem: clipped at 1080p (F3), reversed arrows (F1), event dots without a key. Design: contiguous 7-column grid, 1px rules, 80-88px rows, selected day white-on-green incl. Gregorian number, outlined today, legend or labels for events. Acceptance: whole month visible at 1280x720 and up.

**Settings** (modal: Appearance / Prayer / Alerts / Data / About)
Problem: six theme previews take most of the first tab; small text. Design: compact theme rows with small previews, mode beside them; keep modal but make sections searchable; Adhan volume gets a label + value + test button on one row. Acceptance: Adhan volume reachable in <= 2 clicks (already true); no text < 14px.

**99 Names, Search, Widget/tray/native panel** — *not reviewed*. Widget/tray are native Rust (not web); review needs the installed app (read-only) at 100/125/150/200% DPI.

**Arabic RTL (cross-cutting)**
Use logical CSS properties (`margin-inline-start`, `border-inline-end`, `text-align:start`) in all new rules; decide sidebar side (F6); isolate times/numerals with `dir="ltr"` spans; test every page in AR. Overlay is LTR-tuned and must be converted before implementation.

## 4. Usability workflows (web UI only; native steps untested)

| Workflow | Steps today | Result / issue | Proposed |
|---|---|---|---|
| Find next prayer | 0 (Home) | Visible but competes with banner | Make first element |
| Change Adhan volume | 2 (Settings > Alerts) | Works; small label | Keep, enlarge row |
| Start an adhkar session | 1 (Home card) or 2 (Adhkar > Start) | Start repeated 25x in list | Quiet Start, keyboard open |
| Complete a session | not run | untested | Review session stage |
| Find practice history | not run | tabs exist, content unverified | Verify with real data |
| Open book and resume | not run | untested | Needs data |
| PDF keyboard/mouse | not run | untested | Reader audit |
| Find a setting | 1-2 | Modal tabs OK | Add settings search |
| Dhikr timer start/pause/stop/restart | not run | native widget | Needs installed app |
| Restore hidden window | not run | native tray | Needs installed app |
| Arabic RTL + larger text | partial | sidebar side (F6) | Decide, test 3 pages more |

## 5. Plan alongside the bugfix roadmap

Design work does not touch Rust scheduler/audio/notification code, so it can follow the bug order without conflict:
1. Bugs 1-4 (native: Adhan, timer, toast, window placement) first — no UI dependency.
2. Shell + tokens + type floor + focus (one commit, CSS only, shared by all pages).
3. Bug 5/6 (reset + Practice history) together with the Practice page.
4. Adhkar list, Prayer, Hijri, Tasbih, Library (one commit each, each with before/after shots and the tests above).
5. Bug 7 (PDF reader) design after its own audit.
6. Native widget/tray DPI pass on the installed app.

## 6. Decisions (user, 2026-11-10)

| # | Decision | Consequence |
|---|---|---|
| 1 | **Mirror the sidebar to the right in Arabic** | Use logical properties; sidebar `inset-inline-start`; chevrons and collapse control mirror. |
| 2 | **Tasbih Space/Enter counting approved** | New feature; ignore key-repeat; show the hint only once implemented. |
| 3 | **Scenery on Home only, changing with the prayer phase** | See section 7. Practice, Adhkar and all interior pages: no scenic banners. |
| 4 | **Fonts: keep bundled families** | Verified: Amiri, Tajawal, Cairo, Inter, Manrope, DM Sans all ship an SIL OFL 1.1 file in `assets/fonts/licenses/` (and `native-resources/fonts/OFL-Tajawal.txt`). OFL permits bundling/redistribution; the remaining obligation is keeping the licence + copyright notices with the app (already the case) and not selling the fonts alone. Plan: Amiri (devotional/titles), Tajawal (Arabic UI), **one** Latin UI face (Inter, already bundled) instead of three; drop Manrope and DM Sans files after confirming nothing references them. No new families (no download needed). Note: the open provenance items in `DEV_STATE.md` concern Adhan audio and vendor notices, not fonts. |
| 5 | **Keep the rhythm chart, improve it** | See section 8. |
| 6 | Installed-app read-only review | Not answered. Treated as **not approved**; asked again below. |

## 7. Home scene per prayer phase (preview: `shots/prayer-scenes-mock.png`, source `mock-prayer-scenes.html`)

Home keeps **one** scenic element: a slim strip (target 96-120px tall, full content width) at the top of Home, replacing the 254px hero. It follows the **current phase**, not the next prayer. Boundaries come from the timetable the app already computes (Duha = sunrise+15 min to Dhuhr-5 min, as in `js/views/prayer.js`).

| Phase | Window | Scene | Source today |
|---|---|---|---|
| Fajr | Fajr -> Sunrise | first light, teal to pale yellow | atlas row "dawn" (existing) |
| Sunrise | Sunrise -> +15 min | low flat sun disc on the horizon, warm orange horizon | dawn row + warm tint + sun disc |
| Doha | +15 min -> Dhuhr-5 | soft yellow morning, sun rising | day row + sun disc |
| Dhuhr | Dhuhr-5 -> Asr | bright, near-white haze, sun high ("shiny") | day row + light screen tint (use ~.35, the .55 in the mock washes out the trees) + sun disc |
| Asr | Asr -> Maghrib | amber late afternoon, sun low right | day row + amber tint + sun disc |
| Maghrib | Maghrib -> Isha | orange sunset | atlas row "sunset" (existing) |
| Isha / night | Isha -> next Fajr | night, stars | atlas row "night" (existing) |

Rules:
- Original, already-bundled art only: `assets/home/rhythm-phases.webp` (4 scenes, 105 KB) plus CSS tint and a flat solid sun disc (no glow, no gradient halo). No new image downloads, no new provenance question. If you later want bespoke art for Sunrise/Doha/Dhuhr/Asr, generate flat-vector scenes in the same style (the atlas is clearly generated; check that against the provenance review first).
- Text never sits on the cypress trees: greeting starts >= 200px from the left of the strip; ink colour per phase (dark on Fajr/Sunrise/Doha/Dhuhr/Asr, white on Maghrib/Isha). Check >= 4.5:1 per phase, light and dark themes.
- Switch at the exact boundary while the app is open (reuse the 30-second tick already used for the daily reset); crossfade <= 400 ms, none under `prefers-reduced-motion`.
- Decorative only: `aria-hidden`; the phase name is also given as text ("Dhuhr · until 14:42").
- Arabic: mirror the strip (mosque stays toward the reading start); keep time numerals LTR.
- Acceptance: seven screenshots (one per phase, forced via a debug date override) at 1280x720 and 1920x1080 in EN and AR; the strip never exceeds 120px; Home above-the-fold content (next prayer + practices) is unchanged by the scene.
- Open art quality note: Doha vs Asr rely on tint only; if they look too alike on a real display, shift Asr to a lower sun and stronger amber.

## 8. Rhythm chart: keep, with improvements

Keep the Maghrib-to-Maghrib chart. Changes (small, CSS/JS in `_renderRhythmTimeline`, no timing logic changes):
1. Mark the day boundary: add a "Tomorrow" label and short date at the Fajr/second-day start so the second Fajr/Sunrise/Dhuhr/Asr/Maghrib times are not mistaken for conflicting times (fixes F2).
2. Add a **"Now" marker** (thin vertical line + time) so the current position is explicit.
3. Make event times at least 14px, tabular numerals; keep the existing restricted-window hatching and add a one-line key (hatched = restricted voluntary-prayer windows, already in the page text).
4. Remove the decorative `☾ ✧` loops from the chart area unless they carry a label.
5. Keyboard: each zone is already a button; add visible focus and arrow-key movement between zones.
Acceptance: no two identical prayer names with different times appear unlabelled; "Now" matches the clock within one tick.

## 9. Still need from you

1. Approve **starting implementation**, and where: the workspace is the *backup* (`E:\Backups\...`), which I will not edit. I propose a fresh working clone of `source/` outside the backup (e.g. `C:\Users\Protagonist\workspace\sahib-work`) on a new branch, after the native bug fixes 1-4 are planned (design CSS does not conflict with them).
2. Read-only review of the installed app (widget/tray, DPI) and a data-populated review of Practice history and the PDF reader: yes or no?
