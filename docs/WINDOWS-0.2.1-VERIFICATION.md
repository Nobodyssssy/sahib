# Sahib Windows preview 0.2.1 — verification

Verified on 23 October 2026. Work remains on `codex/windows-tauri`; this report does not authorize merging to `main`.

## Changes

- Maximized windows are distinguished from borderless fullscreen windows. A taskbar widget remains visible over a maximized window, yields to fullscreen, and returns without toggling its setting.
- Right placement stops before the notification area. When Explorer does not expose its tray rectangle, a conservative right-side reserve is used. Left and right spacing are independent.
- One display or all taskbar displays can be selected. Each compact widget supports horizontal dragging, with separate saved logical-pixel positions per monitor. Manual positions and the all-displays preference survive restart.
- Expanded and floating panels measure their contents. Height is capped by the selected monitor's work area; scrolling handles smaller available areas. Panels and prayer cards are opaque, while the saved opacity value controls the frame. There is no translucent text bleed-through.
- The compact widget uses two readable lines for prayer/time and countdown. Daily reminders stay in the expanded panel. The native layout uses physical coordinates and each monitor's DPI, including negative coordinates. Insufficient usable horizontal taskbar width triggers floating fallback.
- Windows, Sahib, Aura, Dracula, Catppuccin, Rosé Pine and Tokyo Night appearances remain available. Semantic CSS tokens replace JavaScript presentation colours. Arabic labels and RTL layout remain supported.
- Windows settings are grouped into visibility/placement, appearance, startup/background and advanced interaction. Click-through is explained, including the tray menu's recovery command. Preferences apply immediately and persist.
- Countdown ticks update only countdown text and approaching-prayer state. The widget receives a small presentation packet rather than the full schedule, normally refreshes every 30 seconds and responds to native events. Audio activity uses a short temporary refresh. Unused extra widget windows are destroyed. Geometry/flags, tray tooltip updates and disk writes are skipped when unchanged.
- The host detects Windows timezone/DST signature changes and large wall-clock jumps, then asks the existing shared prayer provider to refresh. A local cached month is reused only when its timezone still matches the device. Prayer calculation rules, storage identifiers, IndexedDB contracts, audio rights and the two-minute missed-alert policy are unchanged.
- Version is 0.2.1. The Windows branch service-worker cache is v2.14.2, with a matching query version for the shared timezone-cache correction. Public `main` is not deployed by this change.

## Executed checks

| Check | Result |
| --- | --- |
| Native Rust tests | 13 passed |
| Actual packaged Tauri/WebView2 acceptance suite with `--media --windows` | 115 passed |
| Shared resource verification | 57 scripts, 82 HTML resources, 116 precache assets, both recording hashes/rights notices passed |
| Physical primary monitor | 2560×1440 at 125%; work area (0,0)–(2560,1380) |
| Physical second monitor | 1920×1080 at 100%; work area (-1920,0)–(0,1032) |
| Both native widget windows | Compact and expanded captured; panel bounds inside each work area; reminder card visible; no oversized empty area; opaque background |
| Maximized/fullscreen recovery | Separate foreground WinForms fixture on each physical display; maximize stays visible, fullscreen hides, normal restores automatically |
| Notification-area avoidance | Left/right bounds checked on both taskbars |
| Manual positioning | Real OS cursor movement plus WebView pointer input; independent per-monitor positions saved and restored after app restart |
| Taskbar auto-hide | Actual Explorer auto-hide temporarily enabled; widget hides and returns with taskbar hover; original taskbar state/cursor restored in cleanup |
| Appearance/language | Six families in light/dark; Windows follows this host's actual OS appearance; Arabic RTL captured |
| Scheduling | Disabled-alert cancellation, exact deadlines, stale missed-alert suppression, deduplication, restart ledger, clock rollback/forward simulations, simultaneous practice/prayer, suppression flags, timetable expiry, native clock-change event refresh |
| Date/time conversion | Zurich summer/winter, DST transition before/after rollback, Tokyo timezone; stale local-cache timezone replaced in a disposable profile |
| Audio | Standard/Fajr decode and scheduled native output at zero volume; imported audio, stop controls and inactive stream closure |
| Hidden main window | Close-to-tray, scheduled silent event while hidden, start minimized, preferences and fired ledger survive restart |
| Existing app behavior | Navigation, settings, PDF reader and bridge restrictions passed |

All tests used `com.sahib.companion.qa` with a disposable private profile. The installed Sahib profile, personal browser data and startup registration were not modified. Screenshots are actual Tauri WebView captures, not browser mockups. The Arabic/Sunday reminder previews are staged fixtures using the existing calendar helper; they are not claims about the current day.

The machine-readable [verification results](windows-0.2.1/verification.json) contain individual check results, monitor geometry and measurement summaries. Local raw runs are `.qa/windows-acceptance-1792748574679` (115 checks), `.qa/windows-acceptance-1792748455072` (idle sample, 76 checks), and `.qa/windows-acceptance-1792740378288` (0.2.0 baseline, 73 checks). Private profiles are deliberately excluded from version control.

## Idle measurement

Same machine with 16 logical processors, packaged debug QA builds, main window hidden and one primary compact widget. The short samples include the native process and descendant WebView2 processes; they are not installer sizes or a guarantee of long-session performance.

| Metric | 0.2.0 baseline | 0.2.1 refined |
| --- | ---: | ---: |
| Sample duration | 32.518 s | 32.732 s |
| Whole-system normalized CPU | 0.2733% | 0.2327% |
| One-core equivalent CPU | 4.3726% | 3.7234% |
| Mean summed working set | 553.45 MiB | 552.81 MiB |
| Mean private committed memory | 431.66 MiB | 421.26 MiB |

Summed working sets can count shared pages more than once; private commit is not resident RAM. Memory was essentially unchanged; this small sample suggests a modest CPU improvement. No native settings/schedule writes occurred during the refined idle sample. In the packaged UI check, the presentation packet was approximately 2.6 KB versus 35 KB for the full state (JSON character counts); sizes vary with schedule/reminders. Countdown ticks retained existing prayer/reminder DOM nodes.

## Captures

| Capture | Evidence |
| --- | --- |
| Compact, Windows appearance | [Primary compact](windows-0.2.1/taskbar-compact.png) |
| Expanded, Windows appearance | [Primary panel](windows-0.2.1/taskbar-panel.png) |
| Actual 125% monitor, Arabic | [Compact](windows-0.2.1/widget-compact-native.png), [panel](windows-0.2.1/widget-panel-native.png) |
| Actual 100% negative-coordinate monitor, Arabic | [Compact](windows-0.2.1/widget-1-compact-native.png), [panel](windows-0.2.1/widget-1-panel-native.png) |
| Floating light/dark appearances | [Sahib light](windows-0.2.1/widget-sahib-light.png), [Sahib dark](windows-0.2.1/widget-sahib-dark.png) |
| Floating Arabic | [Floating panel](windows-0.2.1/floating-refined.png) |
| Windows Settings | [Grouped controls](windows-0.2.1/windows-settings-refined.png) |
| 150%/200% renderer emulation only | [150%](windows-0.2.1/widget-render-150.png), [200%](windows-0.2.1/widget-render-200.png) |

The emulated captures use a 380×600 logical renderer viewport, so transparent space outside the content-sized card can appear below it. They do not demonstrate Windows scaling at those percentages. Native geometry tests separately cover 100%, 125%, 150% and 200% with positive and negative work areas.

## Remaining limitations / not executed

- Actual Windows display scaling at 150% and 200%, live monitor unplug/replug, primary-display changes, vertical taskbars and alternative shells were not exercised. Real 100%/125% monitors and mathematical geometry tests are the available evidence.
- Physical sleep/resume, changing the real OS clock/timezone, an actual DST transition and a 35-day wait for natural schedule expiry were not performed. Deterministic scheduler/conversion tests, an expired-timetable fixture and the native clock-change refresh event were exercised instead. Old missed sounds remain suppressed according to the existing policy.
- The widget is an independent overlay and cannot reserve Explorer taskbar space. It avoids the Start area and notification area, but crowded pinned/running app buttons may still need manual placement. Real insufficient-width floating fallback and secondary fallback-window dragging were not exercised on these wide taskbars.
- Native audio output was tested at zero volume; speaker loudness, OS notification banner visibility under Focus Assist and all notification policies were not verified. Autostart registration was left untouched. The tray click-through recovery path was reviewed, but not clicked with an automated native menu test.
- QA ran the actual packaged debug app with production CSP and isolated identity. The production NSIS installer is built separately and is unsigned; an install/upgrade over the user's live profile was not performed. No merge to `main` is included.

## Reproduction

Run `npm run desktop:test`, `node tools/verify-release.mjs`, and `npm run desktop:acceptance -- --media --windows` in an interactive Windows session. The display fixture temporarily toggles auto-hide and restores it in cleanup. For an idle comparison use the ordinary suite with `-- --measure`, without the display/media scenarios. Run `npm run desktop:build` and `npm run desktop:checksum` for the production installer.

## Installer

Production NSIS build succeeded: `Sahib_0.2.1_x64-setup.exe`, 23,287,778 bytes (22.21 MiB), unsigned. SHA-256:

```text
6616f51da313c1d2828bfc1ede023a9ca2a74dd5955f7e61d9d9e22809b04f69
```

The local installer and adjacent `.sha256` file are under `src-tauri/target/release/bundle/nsis/` and are excluded from source control. The preview workflow can publish its own build as an Actions artifact; separately built installers need their own checksum.
