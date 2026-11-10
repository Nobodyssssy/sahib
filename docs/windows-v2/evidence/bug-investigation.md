Read-only investigation completed; no files changed or tests executed. `lib.rs` changed externally during inspection, so affected citations below use the re-read version. Static code cannot establish which build or persisted state the installed app uses.

**Bug 1 — Two simultaneous Adhan recordings**

**Top hypothesis: a browser audio producer alongside native playback, but unproven.** HTMLAudio playback exists at `js/prayer-widget.js:623–645`, independently of rodio. However, the normal packaged startup prevents JS scheduled playback: `PrayerAlerts.check()` returns when desktop is available (`:825`); `available` is assigned synchronously (`js/desktop.js:4`), and packaging inserts that adapter before app bootstrap (`tools/prepare-desktop.mjs:24`). Thus, delayed `SahibDesktop.init()` does **not** explain a startup race.

A remaining bypass is `PrayerAlerts.playAdhan`: it captures the original browser function (`js/prayer-widget.js:896`), while desktop initialization replaces only preview/stop methods (`js/desktop.js:140–142`). No application caller of that bypass was found. Browser playback already started would also survive the replacement of the stop function.

**Alternatives, ranked:**

1. An older/mispackaged frontend or separate browser/PWA instance running the browser scheduler. Possible, not established by the single native-process observation.
2. Notification sound accompanying Adhan (`src-tauri/src/lib.rs:1509–1520`). This explains an additional sound, not a second full recording.
3. Duplicate native alerts/previews: strongly disfavored. One worker drops the previous sink (`audio.rs:31–40`); scheduled duplicates retain only one audible event (`scheduler.rs:109–112`). Practice alerts use `sound:'off'` (`js/views/practice.js:1504`); prayer lead alerts use a chime (`js/desktop.js:53`). Both HTMLAudio and rodio explicitly apply volume (`prayer-widget.js:631`, `audio.rs:59`); no scheduled full-volume bypass was found.

**Smallest safe fix:** centralize desktop routing inside the underlying playback functions, including captured exports; stop browser playback before switching ownership.

**Verify:** schedule an Adhan while instrumenting HTMLMediaElement playback and native jobs. Exercise startup, preview, widget opening, and notifications; assert exactly one recording producer and configured volume.

**Bug 2 — Hidden five-minute sound**

**Top hypothesis: persisted repeating native timer.** The complete timer reloads from `desktop-state.json` (`lib.rs:1584–1588`). Repeat advances by stored `seconds` (`session_timer.rs:45–46`), independent of widget visibility. Crucially, **Restart ignores the newly chosen duration**, reusing the old duration/repeat settings (`lib.rs:1212–1215`); preset buttons only edit the input (`js/desktop-widget.js:120`). A stored five-minute repeat therefore continues if the user selects another duration and presses Restart.

Sound without notification is explained separately: notification permission gates the toast, its result is discarded, and audio proceeds independently (`lib.rs:1463–1487`).

**Alternatives:** omitted `seconds` defaults to 300 (`lib.rs:1207`), although the current widget sends explicit seconds (`desktop-widget.js:112`). The daily-reset test explicitly creates a 300-second repeat (`tests/desktop-daily-reset.js:19`); interruption before cleanup could leave it active. No independent five-minute sound loop was found. Practice intervals are calendar-based and native practice audio is off. `tests/desktop-chime-schedule.js:8` schedules prayer chimes, not periodic five-minute playback.

**Smallest safe fix:** make Restart’s stored-duration behavior explicit, or use edited controls; keep active repeat status visible. Report notification failures.

**Verify:** persist a 300-second repeat, restart the app, select ten minutes, then test Restart versus Start/change. Assert deadlines and recurrence; repeat with notifications denied.

**Bug 4 — Main window opens near bottom-center**

**Top hypothesis: missing placement policy; high confidence.** `show_main()` only shows, restores, and focuses (`lib.rs:198–208`). The experimental path behaves likewise (`experiment.rs:108–112`), including recreation from config (`:130`). Main config has dimensions but no `center` or coordinates (`tauri.conf.json:14–26`).

Widget buttons (`desktop-widget.js:123–124`), tray (`lib.rs:1664`), and single-instance shortcut activation (`:1551–1552`) converge on these paths.

**Alternatives:** retained/default Windows placement, oversized dimensions, or DPI changes. The exact bottom-center location cannot be derived statically; no widget-coordinate transfer to main was found.

**Smallest safe fix:** on opening, center the restored outer bounds within the selected monitor’s work area, consistently using physical coordinates; constrain oversized bounds.

**Verify:** invoke all three entry points across mixed-DPI monitors and taskbar positions; compare window and work-area centers.

**Bug 5 — Adhkar completion survives days**

**Top finding: persistent multi-day counts are not explained by the inspected implementation.** Reset uses local `toDateString()`, clears IndexedDB counters, then saves `lastReset` (`store.js:93–105`). Live counters/session indices synchronize through the reset event (`app.js:3–7`). Bootstrap, focus, visibility, and 30-second polling check reset (`app.js:31,152–164`); session entry and tapping also check (`session.js:4,158`).

**Ranked alternatives:** stale installed code; persistence failures; then stale presentation. Hidden windows intentionally skip periodic checks (`app.js:153`). Reset refreshes grids/home/session but omits an open detail counter (`:155–159`). Session completion styling also survives reset. Undated `sessProgress` is saved (`session.js:145–149`) but has no restore reader, so it does not explain retained counts. Service-worker caching (`sw.js:274–284`) matters for browser builds; desktop registration is bypassed (`prepare-desktop.mjs:25`).

**Smallest safe fix:** refresh every open counter surface and clear completion styling on reset; investigate actual persisted counts before changing reset logic.

**Verify:** cross local midnight with list, detail, and completed session open; test hidden/resume and reload, including UTC-offset/DST cases. Assert both IndexedDB and displayed counts reset.