# Windows background memory experiment

The ordinary Windows build keeps its web widget. The native compact view and main-window unloading are opt-in experiments on `codex/windows-tauri`; neither is the default, and this work does not merge into main.

## Three configurations

| Mode | Main window after close to tray | Compact widget | Expanded panel |
| --- | --- | --- | --- |
| `keep` | Hidden and retained, as in 0.2.2 | Existing WebView2 widget | Existing widget window |
| `unload` | Checkpointed and destroyed | Existing WebView2 widget remains operational | Existing widget window |
| `native` | Checkpointed and destroyed | Plain Windows window painted with Rust/Win32 GDI | Existing Tauri panel created on click, destroyed on collapse |

All three use the same Rust scheduler, alert ledger, audio service and tray. The JavaScript prayer provider remains the only calculation engine. Native painting reads the authoritative exported prayer moments, clocks, language and palette. It does not calculate prayer times.

The native prototype uses a plain Tauri window with a Win32 paint/input subclass, in the existing host process. There is no second executable, IPC service, Explorer window parenting, shell modification or injected code. Plain Tauri windows currently require the opt-in `tauri/unstable` feature; the standard build does not enable it.

## Main-window lifecycle

The experimental close-to-tray path waits for active schedule preparation, finishes a schedule sync, checkpoints navigation and counters, and awaits an IndexedDB transaction before destruction. Recreated windows use the same application origin, label and profile directory. No browsing-data clearing or database migration occurs. Navigation checkpoints live in a separate `window-session.json`; original IndexedDB databases, settings and storage keys remain intact.

Category navigation, reader identity/progress and an active Adhkar session have restoration paths. An unfinished Adhkar/category editor deliberately keeps the hidden main renderer loaded, preserving its unsaved draft. Therefore native mode is not a promise of zero WebViews in every possible UI state. A visible rich view also needs WebView2.

Open/Settings/timetable actions recreate the main window asynchronously. Explicit widget actions are queued until the new desktop adapter is ready. Reopening while an unload is pending cancels retirement. The tray remains in the Rust host and Quit still exits the app.

## Keeping calculations current without a persistent renderer

The host retains the existing 35-day schedule. Six-hour refreshes and detected timezone/clock changes can briefly create a hidden main interface, run the same JavaScript provider against the existing profile, and destroy it when complete. A fresh cached schedule and matching recent timezone signature permit compact-only startup without opening WebView2. Stale environments require a refresh. A two-minute timeout retires a stuck hidden refresh without deleting the cached timetable; reopening the UI cancels that timeout's retirement.

The normal cached-schedule, expiry and missed-alert rules remain in force. Old missed Adhan sounds are not replayed. This experiment does not wake a sleeping computer or invent replacement prayer calculations if the provider fails. Physical sleep, clock changes and long-term refresh failures still need extended Windows verification before adoption.

## Visibility and native appearance

The native compact view reuses the existing physical-coordinate taskbar geometry, tray reserve, saved per-monitor positions, event hooks and conditional order recovery. Native code paints the mosque emblem, prayer name/time, countdown and restrained progress. App palette colours come from the shared presentation packet; independent family colours are resolved from shared CSS tokens. Windows colours follow the existing widget appearance.

Start/Search can keep Explorer above an ordinary topmost window. When a point hit-test still reaches the taskbar after a non-activating order repair, compact mode temporarily moves just above the taskbar while that shell surface is active. It returns to its saved position afterward. This is a visible fallback, not an attempt to bypass Windows shell security. Foreground shell processes are distinguished from fullscreen games; genuine fullscreen suppression happens before this recovery. The same safeguard applies to the existing web widget.

The prototype uses Segoe UI/GDI rather than the six bundled web fonts, has no complete UI Automation provider or keyboard-navigation parity, and its CSS palette resolver is deliberately limited rather than a full browser CSS implementation. Native styling and floating fallback need further review. These are reasons to retain the existing implementation as default despite promising memory measurements.

## Reproduce safely

Use an interactive Windows desktop with the MSVC/Rust prerequisites in [Windows setup](WINDOWS.md). Close or minimize immersive applications for visible-widget measurements. Do not run overlapping suites: they share the QA executable and desktop.

```powershell
node tools/compare-widget-memory.mjs --rounds=2
node tools/verify-native-prototype.mjs --restart-explorer
```

The first command builds the optional feature and compares fresh processes with the same fixture. It records main-window visibility and exact native hit-test identity before accepting a compact-widget sample. Its QA widgets use a different position from the installed widget. The second command explicitly restarts the current Explorer shell; it temporarily tests auto-hide and restores the original taskbar state/cursor.

Both use `com.sahib.companion.qa`, disposable profiles under `.qa/`, and a debug-only local test channel. They do not change the installed profile or startup registration. The test channel is absent from release builds. Test audio uses zero volume; notification API acceptance does not prove that Windows displayed a banner through Focus Assist or other policy.

For an intentional feature build, compile with `--features native-widget-experiment` and set `SAHIB_MEMORY_EXPERIMENT` to `keep`, `unload` or `native` for that process. The normal build ignores this environment variable. Do not point test data overrides at personal profiles. Experimental settings are not exposed as a default end-user switch.

## Measurement interpretation

The profiler captures the entire Sahib descendant tree, process role, parent/PID/creation identity, private committed bytes, working sets, private working sets and cumulative/per-interval CPU. It never saves process command lines. CPU is reported both as one-core equivalent and normalized across this machine's logical processors. Very short-lived processes between samples can be missed.

Summed working sets count some shared pages more than once. Private committed bytes are not resident RAM. Private working sets are useful alongside both figures and are closer to the private-resident measure commonly seen in Task Manager. Debug QA numbers are not a release benchmark, and comparisons with an unrelated Task Manager grouping are not exact.

[Microsoft's WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model) explains browser/renderer/helper sharing and controller lifetime. [Tauri's window API](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/) distinguishes destruction from a close request; destruction does not itself clear persistent browsing data. Actual persistence and process termination are separately tested here.

Measurements, actual screenshots, checks and limitations are recorded in [the 0.2.3 verification report](WINDOWS-0.2.3-VERIFICATION.md). No native-default decision is made by this experiment.
