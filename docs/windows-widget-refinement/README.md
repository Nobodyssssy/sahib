# Expanded Windows widget refinement

Branch: `codex/windows-tauri`. No main merge, public release, installer replacement, or installed-profile changes.

## Implementation and reference comparison

The existing panel now has a compact illustrated header containing the prayer name, time, countdown, location and both dates. Six markers share a responsive row. Sunrise has a dashed border, a visible Marker label and an explicit accessible description. Elapsed markers are subdued, without completion ticks. After Isha, the upcoming day's grid is explicitly dated so its highlighted Fajr time matches the header.

Actual pending daily practices precede the timer: two remain visible on constrained panels and a third is allowed when space permits. View all opens the existing practice view. Completion uses the existing store and schedule synchronization, without invented rows or counts.

The timer defaults to an accessible summary button, while retaining every control. Completion and errors reveal controls; timer operation stays independent of expansion. The panel has one scrolling surface. Static CSS/SVG atmosphere and small native GDI celestial marks distinguish the six periods while retaining the selected palette. The artwork remains deliberately subtle at real window dimensions.

Native compact right-click, F10 and the Apps key reuse the tray menu builder and one global command handler. The left-click toggle remains separate. Native accessibility announcements identify Sunrise as a time marker. Renderer-switch regression also exposed an existing UIA cache reentrancy panic; cached providers are now cloned before Windows UIA calls, outside RefCell borrows.

The panel loads on demand, suspends when hidden and unloads after a five-second idle lease, serviced by the existing window watcher. Eager preload and indefinite retention while the main window was visible were removed. Timer, notification and audio ownership stay in Rust.

## Actual screenshot evidence

Expanded images are captures of the running Windows Tauri WebView2 at its actual window dimensions. Native compact/menu images use Windows Computer Use. Contact sheets only resize and label original captures.

- [Before/after](before-after.png), also available as [before](before.png) and [after](after.png). Same window width and display scale. The baseline QA profile has no enabled practice rows; the after fixture enables existing built-in practices. Countdown differences reflect capture time.
- [Six expanded states](six-states.png): controlled widget presentation times selected from the real local timetable for the following day. No system-clock or prayer-data changes. The presentation clock does not drive timers or notifications.
- Originals: [night](night.png), [dawn](dawn.png), [morning](morning.png), [afternoon](afternoon.png), [sunset](sunset.png), [evening](evening.png).
- [Arabic light](arabic-light.png), [Arabic dark](arabic-dark.png), [expanded timer](timer-expanded.png), [native menu](native-menu.jpg).
- Native originals: [night](native-night.jpg), [dawn](native-dawn.jpg), [morning](native-morning.jpg), [afternoon](native-afternoon.jpg), [sunset](native-sunset.jpg), [evening](native-evening.jpg).

## Verification

- All eight updated lifecycle checks passed on the final build, including native/fallback/floating transitions, timer continuity and native-only background operation.
- All 23 Rust unit tests passed, including timer repetition/focus/completion, audio decoding and monitor/DPI geometry.
- Release resource verification passed: 57 scripts, 82 HTML resources, no failures. JavaScript syntax and Git whitespace checks passed.
- All 53 application checks below passed. Language tests regenerate actual schedule/practice translations. The six named theme families were tested in light/dark and English/Arabic. Windows appearance was tested with the current OS setting; Windows personalization was not changed.
- Native right-click and F10 opened the six shared actions. Selecting Show/hide through the menu hid the widgets without opening a panel. Quit through the native menu exited only the isolated QA app.
- The tray remained registered while widgets were hidden and click-through was enabled. The QA command route through the same tray recovery handler restored both widgets and cleared click-through. This recovery check exercises the shared handler rather than clicking the user's real tray icon.
- Native menu placement was checked at both safe taskbar edges on DISPLAY1 at 125% and DISPLAY2 at 100%, including negative secondary coordinates. Menus stayed within their screens. Higher-scale geometry has Rust test coverage; physical 150%/200% display settings were not changed.
- Closing both rich windows left only `sahib-desktop` in the process tree, with no WebView2 descendant. A short optimized QA sample measured 76.34 MiB mean working set and 0.041% system CPU. This ten-second sample is a smoke measurement, not a general benchmark.

## Repeating the checks

Prepare with `node tools/prepare-desktop.mjs`, then build using the existing isolated QA identifier and `desktop-qa` feature. Run `node tools/verify-expanded-widget.mjs`; `--hold` keeps the isolated app available for native input inspection. Each run creates a fresh QA profile. The presentation-time and menu-command hooks require the QA identifier/data directory and are excluded from ordinary release builds.

`tools/verify-panel-lifecycle.mjs` now checks cold on-demand startup, immediate warm reopen, eviction with the main window visible, timer continuity, compatibility/floating modes and native-only background operation.

| Application check | Result |
| --- | --- |
| Panel loads only on demand | PASS |
| Collapsed timer by default | PASS |
| Daily practice before timer | PASS |
| At least two actual practices visible | PASS |
| Practice has no nested scroll | PASS |
| night correct next transition | PASS |
| dawn correct next transition | PASS |
| morning correct next transition | PASS |
| afternoon correct next transition | PASS |
| sunset correct next transition | PASS |
| evening correct next transition | PASS |
| sahib en light controls fit | PASS |
| sahib en dark controls fit | PASS |
| sahib ar light controls fit | PASS |
| sahib ar dark controls fit | PASS |
| aura en light controls fit | PASS |
| aura en dark controls fit | PASS |
| aura ar light controls fit | PASS |
| aura ar dark controls fit | PASS |
| dracula en light controls fit | PASS |
| dracula en dark controls fit | PASS |
| dracula ar light controls fit | PASS |
| dracula ar dark controls fit | PASS |
| catppuccin en light controls fit | PASS |
| catppuccin en dark controls fit | PASS |
| catppuccin ar light controls fit | PASS |
| catppuccin ar dark controls fit | PASS |
| rose-pine en light controls fit | PASS |
| rose-pine en dark controls fit | PASS |
| rose-pine ar light controls fit | PASS |
| rose-pine ar dark controls fit | PASS |
| tokyo-night en light controls fit | PASS |
| tokyo-night en dark controls fit | PASS |
| tokyo-night ar light controls fit | PASS |
| tokyo-night ar dark controls fit | PASS |
| windows en light controls fit | PASS |
| windows en dark controls fit | PASS |
| windows ar light controls fit | PASS |
| windows ar dark controls fit | PASS |
| Keyboard expands timer | PASS |
| Timer start repeat focus | PASS |
| Collapse preserves running timer | PASS |
| Timer stops | PASS |
| Timer actually repeats | PASS |
| Completion reveals essential controls | PASS |
| Finished form can collapse | PASS |
| Practice completion removes pending preview | PASS |
| View all opens actual practice | PASS |
| Panel placement \\.\DISPLAY2 | PASS |
| Panel placement \\.\DISPLAY1 | PASS |
| Closed panel unloads while main stays open | PASS |
| Timer survives panel unload | PASS |
| Reopened timer is collapsed and running | PASS |
