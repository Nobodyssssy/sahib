# Sahib — Desktop Design Review

**Date:** 2026-10-20
**Branch:** `redesign/pc-first`
**Checkpoint:** Desktop / PC-first redesign, pre-Android
**Reviewed against:** `DESIGN_DIRECTIONS.md` (hand-bound almanac), `.opencode/skills/sahib-almanac/SKILL.md`, `sahib-context.txt`, `REDESIGN_PROGRESS.md`
**Service worker under review:** `v2.10.71`

> Context note: `Objective.txt` was not present on disk when this pass began. The review uses the design direction, project context, progress log and almanac skill as the available authorities.

---

## 1. Verdict

**Desktop review: pass, with fixes applied.**

The almanac direction is present in composition, typography, rules and restraint — not just in colour. Home reads as a dated agenda, Daily Practice as a daybook, Prayer as a timetable with a printed daily strip, and Settings as an inserted leaf. All five theme families and both modes remain coherent after the contrast corrections below.

The remaining work is Stage 2 (Android/touch) plus known enhancements already listed in `REDESIGN_PROGRESS.md`; none of it blocks desktop review.

---

## 2. What was reviewed

| Surface | Evidence |
| --- | --- |
| App shell | Sidebar, topbar, active navigation, collapse control, RTL sidebar placement |
| Home | Dated masthead, live next-prayer widget, reading page, daybook panel, index, daily cycle, colophon |
| Daily Practice | Today, Upcoming, Calendar, All Practices, starter-daybook state |
| Prayer | Today timetable, next-prayer card, month/tools, daily cycle, forbidden/night segments |
| Settings | Appearance, Prayer, Alerts, Data, About tabs |
| Adhkar / Hijri / Asma / Library / Tasbih | Module boot, content render, layout at desktop and narrow widths |
| Themes | Catppuccin, Aura, Dracula, Tokyo Night, Rosé Pine; light and dark; nine accents |
| States | Fresh profile (no location), seeded location (Algiers), starter practices enabled |
| Offline | Service worker control, cache keys, offline reload |

Screenshots were captured at 1200, 1440, 1920 and 390 px during the headless run. They live in the local test folder (not the repository), consistent with the project's checkpoint policy.

---

## 3. Almanac direction check

### Composition

- Home uses a masthead with Hijri and Gregorian dates, a ruled hero, a live prayer column, a reading page and a daybook — not a grid of identical dashboard cards.
- Daily Practice reads at a larger scale: a dated daybook, an upcoming ledger, a calendar spread and a catalog.
- Prayer keeps the information density of a timetable while the daily cycle retains its printed-strip character.
- Dialogs sit as inserted leaves; the Settings modal keeps a pinned footer and a scrollable body.
- Rules, margins and spacing carry hierarchy. No paper grain, torn edges or ornamental frames were used.

### Typography and bilingual handling

- Arabic display type is primary; Latin labels remain working annotations.
- English prose inside the RTL shell is explicitly direction-corrected in the Practice and Home copy blocks.
- Arabic labels are not letter-spaced; Latin metadata uses the label face.
- Navigation pairs English and Arabic cleanly, and the active item keeps the accent on its icon while the labels remain ink.

### Density and restraint

- The desktop width is used intentionally; content is not trapped in a narrow column.
- Metadata is small and quiet, but the contrast pass below keeps meaningful text at AA.
- The index is ruled rows rather than feature-card repetition.
- Empty states are written as part of the page ("The daybook is yours to shape"), not as errors.

---

## 4. Verification

### 4.1 Static checks

| Check | Result |
| --- | --- |
| `node --check` on all changed/new JS (`app`, `prayer`, `prayer-widget`, `settings`, `theme`, `utils`, views, `practices-data`, `practice`, `sw`) | Pass |
| Literal `\n` / `\r` / `\t` typos in `css/design.css` | None found |
| `css/design.css` brace balance | 1265 open / 1265 close |
| `css/design.css` comment balance | 60 open / 60 close |
| CSSOM parse in Edge | 14 stylesheets parsed; no CSS rule exceptions |
| `sw.js` `APP_SHELL` entries | 100; 0 duplicates; 0 missing |
| `index.html` local `src`/`href` references | 68; 0 missing |
| `index.html` scripts | 54; 0 duplicates |
| Cache exemptions | `sahib-books` and `sahib-asma-audio` present |

### 4.2 Headless Edge smoke

Environment: Edge headless (new mode) via CDP, local Python HTTP server, fresh test profile.

| Area | Result |
| --- | --- |
| Boot | Home active, 12 views, 10 nav items, taxonomy loaded, no exceptions |
| Modules | Practice (4 tabs), Prayer, Hijri, Asma, Library, Tasbih, Categories, Settings all render |
| Overflow | None at 1920, 1600, 1440, 1280, 1200, 1024, 960, 768, 390 |
| Themes | 5 families × light/dark applied and rendered |
| Accent fills | Primary-button text contrast 7.08:1–12.91:1 across nine accents |
| Service worker | `sahib-v2.10.71` + `sahib-books` only; controller active |
| Offline reload | Home boots from cache with the same shell and widgets |
| Console | No errors or warnings in the final pass |

### 4.3 Contrast

Measured from computed styles, with alpha compositing and canvas colour normalization. Text is judged at 4.5:1 (normal) or 3:1 (large).

| Theme / mode | Failures before fixes | Failures after fixes |
| --- | --- | --- |
| Catppuccin dark | 0 | 0 |
| Catppuccin light | 6 | 0 |
| Aura dark | 0 | 0 |
| Aura light | 0 | 0 |
| Dracula dark | 1 | 0 |
| Dracula light | 0 | 0 |
| Tokyo Night dark | 0 | 0 |
| Tokyo Night light | 0 | 0 |
| Rosé Pine dark | 0 | 0 |
| Rosé Pine light | 7 | 0 |

**Fixes applied**

1. **Active sidebar Arabic label** — was under AA on the accent-subtle fill: 3.92:1 in Catppuccin light with accent ink, and still 4.42:1 in Dracula dark with secondary ink. It now uses `--color-text-primary`, matching the active English label while the icon keeps the accent.
2. **Daily-cycle metadata in light mode** — legacy `css/views/prayer.css` rules use a more specific two-class selector with accent ink. The cycle title, help button, marker labels and Hijri strip now restate legibility with equal specificity and `--color-text-secondary` in light mode. The dark treatment keeps the accent.
3. **Rosé Pine light secondary ink** — `#6e6a86` measured 4.49:1 on the widget surface. Calibrated to `#68647f` (4.90:1 on the same surface).

---

## 5. Findings and follow-ups

### Blocking for desktop

None.

### Non-blocking, already tracked

- **Android/touch layout** — Stage 2 has not started. The <961px fallback is usable and has no horizontal overflow, but touch targets, bottom navigation, safe-area insets and mobile Prayer/Settings flows are deliberately out of scope here.
- **Aria-label sweep** — some legacy icon-only controls (session back/close, category add, export) still lack explicit accessible names. This is README roadmap item 18 and is separate from the contrast pass.
- **Timeline legibility** — cycle metadata now passes AA, but it remains 9.5–10px by design. A future pass may reduce tick density or move labels below the strip; not a release blocker at desktop size.
- **Notification limits** — reminders remain browser-bound while Sahib is open/awake. This is already documented in Settings → Alerts and `REDESIGN_PROGRESS.md`.
- **Location-dependent Prayer** — a fresh profile shows the location empty state by design. The populated timetable was verified with a seeded Algiers location.
- **Test repeatability** — the repository has no test suite. This pass used temporary CDP scripts outside the repo; they were not committed. A future CI smoke script would make the checkpoint easier to repeat.

---

## 6. Files changed in this pass

- `css/design.css` — active sidebar Arabic ink; light-mode cycle metadata overrides.
- `css/tokens.css` — Rosé Pine light secondary ink calibration.
- `sw.js` — `v2.10.70` → `v2.10.71`.
- `DESIGN_REVIEW.md` — this review.
- `REDESIGN_PROGRESS.md`, `README.md`, `sahib-context.txt` — checkpoint/version updates.

## 7. Review gate

- [x] Desktop implementation reviewed against the almanac direction.
- [x] Static, browser, theme, contrast, overflow and offline checks run.
- [x] Blocking contrast issues fixed and re-tested.
- [ ] User review of the desktop checkpoint; collect remaining fixes.
- [ ] Stage 2 (Android) only after desktop approval.
