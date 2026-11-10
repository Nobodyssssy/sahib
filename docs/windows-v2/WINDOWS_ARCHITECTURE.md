# Windows architecture — recommendation

## Current state (from the code)
- Tauri v2.12.5 shell, Rust core ~6.4k lines in `src-tauri/src`, plain-JS frontend (58 scripts, no framework). The desktop build already bypasses the service worker (`tools/prepare-desktop.mjs`) and injects the adapter `js/desktop.js`.
- Native owners today: scheduler thread (`lib.rs`, `scheduler.rs`), audio worker (`audio.rs`, rodio), session timer (`session_timer.rs`), tray, notifications, single-instance, autostart, native Win32 compact widget hosted in the taskbar (`native_widget.rs`, `taskbar_host.rs`, Windows crates behind `native-widget-experiment`, default-on).
- Windows-only modules: `native_widget`, `native_text`, `native_accessibility`, `taskbar_host`; `taskbar`/`widget_watch` are Win32-oriented (not verified portable). Portable: `audio`, `scheduler`, `session_timer`, `placement::centered`, most of `lib.rs`.

## Options
| | A. Tauri + dedicated desktop UI layer | B. A + more native pieces | C. Fully native UI |
|---|---|---|---|
| Maintenance | One frontend, media-gated desktop CSS and adapter | Two renderers for the same feature | Rewrite of 58 scripts + PDF + Arabic text |
| Performance | WebView2 suspended/evicted already (measured in DEV_STATE) | Slightly better for widget (already done) | Best, but unmeasured gain |
| Linux | WebKitGTK, same frontend | Windows-only parts must be re-done | Second toolkit |
| Arabic typography | Browser shaping, bundled Amiri/Tajawal (OFL) | Native DirectWrite only for widget (done) | Must rebuild |
| PDF | PDFium/EmbedPDF kept | Kept | Rebuild |
| Accessibility | Web a11y + native widget UIA (exists) | Same | Rebuilt |
| Migration risk | Low | Medium | High |

## Recommendation: A, with the native widget kept as is
Keep Tauri v2 and refine the frontend into a desktop layer in place (not a fork of the PWA): `css/desktop-v2.css` (desktop-only media query, theme tokens, logical properties) plus the existing adapter. Do not rewrite in a native toolkit: there is no measured gain that justifies re-doing Arabic text, PDF and 58 scripts.

### Contracts and ownership
- **Rust owns**: prayer/practice scheduling, all audio output, timer state, notifications, window placement, tray. **JS owns**: rendering, preferences UI, IndexedDB content.
- Audio: exactly one producer (native). The browser player stays only for the website. Enforced in `playPrayerAdhan`/`stopPrayerAdhan`/`playPrayerChime` when `SahibDesktop.available`.
- Events (existing): `sahib:desktop-state`, `sahib:refresh-schedule`, `sahib:clock-changed`, `sahib:desktop-alert`, `sahib:desktop-error`. Document and keep them stable; add new behaviour as commands, not new loops.
- No orphaned timers: a timer has one record (`SessionTimer`), one start/restart/stop path, one persisted copy; Stop clears all fields (tested).
- No duplicate background WebViews (60 s lease, existing).

### PWA decoupling plan (incremental)
1. Keep one source tree; desktop-only CSS/JS is gated by `@media (min-width: 900px)` or `window.__TAURI__`. 2. Stop sharing the service-worker precache list with desktop (the list still feeds `verify-release`). 3. Persist desktop-only state (window geometry, timer) in Rust files, not IndexedDB. 4. Add unit tests for domain logic that currently lives in views (reset, phase, practice schedule) following `tests/unit/`.

### Risks
Distribution is still blocked by unverified Adhan/Names audio and vendor notices (see `DEV_STATE.md`); this plan changes none of that.
