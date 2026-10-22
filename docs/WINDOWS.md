# Windows desktop preview

The Windows host shares Sahib's existing HTML/CSS/JavaScript application. Tauri owns the tray, windows, startup registration, notifications, scheduling and audio output. Android remains planned.

## Build

Install Node.js 22+, current stable Rust with the MSVC target, Microsoft C++ Build Tools with the Windows SDK, and WebView2. Then run `npm ci`, `npm run desktop:test`, and `npm run desktop:build`. The per-user NSIS installer is written to `src-tauri/target/release/bundle/nsis/`. An unsigned preview installer may require Windows confirmation. Production signing and automatic updates are not configured.

`npm run desktop:dev` runs a local desktop build. `tools/prepare-desktop.mjs` copies an explicit runtime allowlist into `dist/`; it excludes private imports, reports and tests. The browser website has no new build requirement. Only the packaged entry loads `js/desktop.js` and skips browser service-worker registration.

## Scheduling contract

The shared JavaScript prayer provider generates the timetable. API timetables carry their IANA timezone; offline Adhan.js timetables retain the device timezone they use. The shared date converter resolves wall-clock times into UTC milliseconds using the date's DST offset. Rust never calculates a second prayer timetable.

The adapter exports 35 days of prayer moments and enabled alerts. Each alert has a stable identity, UTC time, title/body, sound selection, volume and notification flag. A replacement cancels obsolete events. The native host persists the schedule and a fired-event ledger, prevents multiple app instances, and checks deadlines independently of WebView timers. Practice occurrences/completion/quiet-hours rules come from the existing daybook. Prayer preference or practice changes invalidate pending native alerts before rebuilding the schedule.

The schedule refreshes on setting changes and every six hours while running. Saved future events survive an app restart. Alerts older than two minutes do not replay after sleep; if several are due on resume, only the latest may sound. The scheduler does not wake a sleeping PC. Quitting Sahib stops reminders. The cached schedule has a finite horizon; open the app to refresh it if the widget reports expiry. Native scheduling stays active when the main window is hidden in the tray.

## Window and widget

Settings → Windows offers close-to-tray, optional startup, start minimized, widget visibility, always-on-top, opacity and click-through. Drag the widget header to move it; its position is saved. The tray menu can restore widget clicks, stop audio, reopen Sahib or quit. One shared schedule supplies the window, widget and tray tooltip. The widget follows the app's language, palette and font.

## Storage and audio

The desktop WebView has its own profile, separate from the browser/PWA. Existing JavaScript APIs, IndexedDB database/store names and application data formats remain unchanged. Browser data is not automatically copied. Existing export/import tools transfer the data they support; locally imported PDFs/audio and other preferences may need separate re-import/configuration.

Native host settings, schedules and its fired-event ledger live under the app's local data directory (`com.sahib.companion`). Imported adhan audio is validated and copied into that private directory for playback while the window is hidden. Bundled recordings retain the notices in `assets/adhan/LICENSES.md`; this native build grants no additional recording rights. The native mixer opens only for playback and closes when idle. Stop is available in the app, widget and tray.

Only local application windows can use the bridge. Main-only commands reject calls from the widget. Audio selections use fixed identifiers and private slots; paths from the UI cannot read arbitrary files. External HTTP(S) links open through the OS. Remote top-level navigation inside the privileged WebView is blocked. No general filesystem or shell API is exposed to the UI.

## Verification limits

Rust tests cover schedule validation, restart deduplication, missed-event suppression, cancellation, and decoding without opening an audio device. Real WebView checks must additionally cover startup, language/theme, prayer settings, PDFs, native playback/stop, hiding/reopening, widget preferences and restart persistence. OS notification visibility depends on Windows notification settings and Focus Assist. Autostart changes the current user's Windows startup registration only when explicitly enabled in Settings.

`tests/desktop-smoke.js` is a browser expression for a disposable native test profile. Do not run smoke tests against personal data. Debug builds accept `SAHIB_TEST_DATA_DIR` to isolate both the host state and WebView profile; release builds ignore that override. A temporary `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224` enables local test inspection only when explicitly set in the test environment. Do not enable remote debugging for ordinary use.
