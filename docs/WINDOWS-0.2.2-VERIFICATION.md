# Sahib Windows preview 0.2.2 — verification

Verified on 23 October 2026 on `codex/windows-tauri`. This preview has not been merged into `main`. The release remains unsigned.

## Reproduced cause and recovery

The old 0.2.1 widget could be physically covered by Explorer while remaining a valid, visible, uncloaked, topmost native window at the correct coordinates. Promoting the actual taskbar reproduced this: the taskbar ranked above the widget, and a native point hit-test reached `Shell_TrayWnd`. It remained covered 6.5 seconds later. A renderer screenshot or `is_visible()` alone would have missed this defect.

0.2.2 observes out-of-context Windows foreground, shell structure/location, minimize, desktop and cloaking events. It coalesces notifications, then checks actual native visibility, bounds, stacking and center-point coverage. It repairs demonstrated taskbar coverage or lost topmost status using `SetWindowPos` without activation. Unchanged checks do not repeat the order operation. A ten-second fallback audit replaces the old two-second geometry polling. Missing taskbars after an existing attachment suppress the widget while the shell rebuilds; missing widget windows can be recreated. These lifecycle paths are instrumented, but an actual Explorer restart was not performed.

Fullscreen suppression runs before order recovery. Foreground client-area coverage handles ordinary fullscreen and maximized borderless windows without treating every maximized outer frame as immersive. Auto-hide and user-hidden states have separate logged reasons. Virtual-desktop cloaking is observed and not forcibly overridden.

During a 600.003-second test, actual primary and secondary Explorer taskbars were promoted above their widgets 37 times. All 37 native checks recovered without toggling visibility or recreating the window. Diagnostic recovery latency ranged from 37–137 ms, median 132 ms. This measures taskbar-promotion time to the recorded completed order repair, not input-to-photon latency. Native hit-testing and screen-region captures separately confirmed the widget was uncovered. Recovery did not activate a previously inactive widget. Other user foreground switches were allowed during the test.

The test recorded 496 audits, 44 order repairs, two hides and two shows; there were no moves, resizes or recorded primary recreations during this interval. The 37 deliberate shell promotions account for most repairs; the remainder occurred during other desktop activity. This stress run is evidence for the reproduced stacking failure, not a claim that every intermittent Windows condition has been solved.

## Interface changes

- Compact mode now has a small mosque emblem, a divider, prayer/time, larger countdown and restrained palette progress. Long reminders stay in the panel.
- Expanded/floating panels use a stronger prayer/time hierarchy, location, dates, six recognizable time icons, a highlighted next prayer, upcoming practice/fasting reminder, and three footer actions: Open Sahib, Full timetable and Settings. A faint original SVG landscape supports the design without replacing interactive content.
- Content determines panel height, capped by monitor work area. Opaque text/card surfaces prevent background bleed-through. Windows appearance, six theme families, selected fonts, saved frame opacity and Arabic RTL remain supported.
- Native audio state now emits an immediate UI event when playback starts/stops/completes, so the Stop control tracks actual audio activity.
- Prayer calculation rules, shared schedule and storage contracts, browser paths, recording rights, and the missed-Adhan policy are unchanged. Desktop-only changes leave the service-worker cache at v2.14.2.

## Executed checks

| Check | Result |
| --- | --- |
| Native Rust tests | 13 passed |
| Actual packaged QA app, media + Windows + recovery + ten-minute test | 120 passed |
| Separate fresh packaged run with idle measurement | 81 passed |
| Shared resource verification | 57 scripts, 82 HTML resources, 116 precache assets; recording hashes and rights checks passed |
| Physical primary monitor | 2560×1440, 125%, work area (0,0)–(2560,1380) |
| Physical secondary monitor | 1920×1080, 100%, work area (-1920,0)–(0,1032) |
| Both displays | Compact/expanded bounds, content fit, opaque surface, left/right tray avoidance, separate saved manual positions and restart persistence passed |
| Maximized/fullscreen/borderless maximized | Foreground native WinForms fixtures on both displays: ordinary maximized stays visible, full client coverage hides, normal restores |
| Explorer auto-hide | Actual setting temporarily enabled; hiding/hover recovery passed; original state and cursor restored |
| Appearance | Six families light/dark and Windows appearance captured; Arabic RTL panel captured |
| Native media | Scheduled standard and Fajr recordings start native streams at real deadlines, at zero volume; imported audio/PDF rendering and Stop passed |
| Alerts and persistence | Disabled-alert cancellation, chime-only reminders, hidden-window native event, schedule expiry, restart fired ledger and preferences passed |
| Shared timetable | Zurich summer/winter and DST offsets, Tokyo timezone, stale-cache timezone invalidation, calendar reminders and native clock-change refresh passed |
| Existing app | Navigation, settings, PDF reader and bridge restrictions passed |

Tests used `com.sahib.companion.qa`, disposable profiles and the actual Tauri/WebView2 executable. The installed Sahib profile, personal browser storage and startup registration were not changed. QA processes are closed by the harness. Reminder/date examples in captures are staged fixtures, not claims about today's calendar. Most UI captures are actual WebView renders; the baseline and soak screen-region captures additionally show physical Explorer occlusion/recovery.

The [machine-readable results](windows-0.2.2/verification.json) retain individual checks, native observations, recovery samples and measurement data. Local raw runs: `.qa/windows-acceptance-1792750269319` (old baseline reproduction), `.qa/windows-acceptance-1792751339082` (120 checks), and `.qa/windows-acceptance-1792752206172` (fresh idle sample). The recorded source commit identifies the base commit with working changes; the verified change is the commit containing this report.

## Performance and WebView2

Fresh packaged debug QA processes, same 16-logical-processor machine, main hidden and one primary compact widget. No release-memory equivalence is claimed.

| Metric | 0.2.1 baseline | 0.2.2 fresh sample |
| --- | ---: | ---: |
| Duration | 32.732 s | 32.961 s |
| Whole-system normalized CPU | 0.2327% | 0.2341% |
| One-core equivalent CPU | 3.7234% | 3.7450% |
| Mean summed working sets | 552.81 MiB | 555.85 MiB |
| Mean private committed memory | 421.26 MiB | 442.39 MiB |

CPU and working sets are essentially unchanged in these short samples; private commit increased by about 21 MiB. Summed working sets can count shared pages twice; private commit is not resident RAM. This is a reliability/UI improvement, not a demonstrated memory reduction. No native schedule/settings file writes occurred during the idle sample. Countdown rendering remains once per second; presentation refresh is normally 30 seconds plus native state events, rather than a per-second bridge query. Native audits depend on desktop events plus the ten-second fallback.

Spawn-to-adapter-ready times were 1,760/669 ms in the extended run and 817/840 ms in the fresh idle run (initial/restart). These are local warm-machine observations, not a cold-start benchmark.

WebView2 remains expected while this widget is enabled: compact mode itself is web-rendered, and the hidden main interface remains loaded. The Rust scheduler/audio does not depend on an open main window, but the current UI lifecycle retains its runtime. Removing WebView2 from compact-only use requires a native compact host and unloading/recreating hidden web interfaces. That change is **not implemented** here. The [hosting evaluation](WINDOWS-WIDGET-HOSTING.md) compares this overlay with a separate native compact companion and explains Explorer parenting, DPI and maintenance risks. No Explorer code injection or parenting was added.

## Captures

| Capture | Evidence |
| --- | --- |
| Old build, physical taskbar cover | [Before](windows-0.2.2/baseline-before.png), [covered](windows-0.2.2/baseline-covered.png) |
| New build, physical recovery | [Covered](windows-0.2.2/soak-widget-covered.png), [recovered](windows-0.2.2/soak-widget-recovered.png) |
| Compact and expanded | [Compact](windows-0.2.2/taskbar-compact.png), [panel](windows-0.2.2/taskbar-panel.png) |
| Light/dark floating | [Light](windows-0.2.2/widget-sahib-light.png), [dark](windows-0.2.2/widget-sahib-dark.png), [Arabic floating](windows-0.2.2/floating-refined.png) |
| Physical 125% Arabic | [Compact](windows-0.2.2/widget-compact-native.png), [panel](windows-0.2.2/widget-panel-native.png) |
| Physical 100%, negative coordinates, Arabic | [Compact](windows-0.2.2/widget-1-compact-native.png), [panel](windows-0.2.2/widget-1-panel-native.png) |
| Windows settings | [Controls](windows-0.2.2/windows-settings-refined.png) |
| Renderer emulation only | [150%](windows-0.2.2/widget-render-150.png), [200%](windows-0.2.2/widget-render-200.png) |

The 150%/200% captures emulate a 380×600 logical renderer viewport; space outside the card is not an oversized native window. They do not verify actual Windows scaling at those values.

## Remaining verification

Not executed: actual Explorer process restart, controlled Alt+Tab/Win+D/Win+Tab and virtual-desktop switching, lock/unlock, physical sleep/resume, real game/DXGI fullscreen or fullscreen video, Windows notification popup overlap, monitor hot-plug, changing the primary display, live OS DPI changes/physical 150% and 200%, and alternate taskbar positions or shell replacements. Foreground fullscreen fixtures do not substitute for actual games. Clock/DST conversions and scheduler simulations do not substitute for changing this computer's clock or sleeping it.

These require further interactive Windows review before treating the preview as release-ready or merging to main. Unexpected future cases can be investigated with the bounded diagnostic log described in [Windows setup](WINDOWS.md).

## Installer

`Sahib_0.2.2_x64-setup.exe`: 23,297,673 bytes (22.22 MiB).

SHA-256: `ef87c32d833471f47886580b22c716a46ba6a6cbdb9f59b3aae7f4960efc3073`.

Build output: `src-tauri/target/release/bundle/nsis/`. Installer/checksum files remain generated artifacts, not source-controlled binaries. Signing and automatic updates remain unconfigured.
