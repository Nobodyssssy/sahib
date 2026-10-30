# Expanded-widget opening performance

Branch: `codex/windows-tauri`. Measured on 2026-10-30 on Windows 11 build 26100, x64, 16 logical processors. These are optimized **release QA builds**, with isolated profiles and the same native panel-opening handler as the compact widget. The installed Sahib profile was not used or changed.

## Before and after

| Interaction | Before | After |
|---|---:|---:|
| First cold open after native-only startup | 564 ms | 442 ms |
| Reopen median, four trials | 494 ms | 35 ms |
| Reopen range | 493–516 ms | 22–56 ms |
| First open with opportunistic preload already ready | Not measured | 59 ms |
| Cold recreation after cache eviction | — | 494 ms |

Repeated opening improved about 93%. The first cold sample improved about 22%. True cold creation still costs roughly half a second; it is not instant, and the post-eviction sample overlaps the old rebuild range. Measurements do not reproduce every reported multi-second case under other workloads.

The clock starts inside the native opening handler, excluding the QA command transport/poll interval. Content-ready means the authoritative state has rendered and two animation-frame callbacks have run. It is a useful software rendering marker, **not** hardware click-to-photon latency. First-cold comparisons have one startup sample per build; the reopen comparison has four samples each.

## Where time was spent

First cold-open sample, cumulative native elapsed time:

| Marker | Before | After |
|---|---:|---:|
| Tauri window + WebView2 controller construction returned | 367 ms | 348 ms |
| Window show/focus requested | 385 ms | 353 ms |
| Navigation-start callback | 445 ms | 382 ms |
| State rendered | 505 ms | 394 ms |
| Two-frame content-ready marker | 564 ms | 442 ms |

Tauri constructs the native window and WebView controller together; this audit does not invent separate HWND and controller durations. Document-relative CSS completion was 103 ms before / 63 ms after, and widget JS began at 107 / 66 ms. A bridge fetch of the initial state took 2–4 ms before; the cached native bootstrap removes that dependency from first rendering. These document-relative values overlap the native timeline and should not be added to it.

## Change

- Keep one rich panel and reuse it through show/hide, preserving its loaded DOM, CSS and listeners.
- Suspend its hidden WebView2 renderer and stop widget JS intervals/refresh work while hidden. Explicitly resume before showing; refresh from the authoritative native snapshot and current clock, then reconcile live state.
- Use a 60-second idle lease when the main window is closed/hidden. The existing approximately ten-second watchdog releases the cached WebView after expiry; release may therefore occur later than exactly 60 seconds. Disabling the widget still releases it. No new perpetual polling loop is added.
- Opportunistically preload after a short deferred interval only while the full main app is already visible. Native-only background startup does not create a WebView just to preload this panel. An opening request interrupts the deferred preload wait.
- Bootstrap the same filtered native prayer/timer/prefs payload used by the existing widget API. No second prayer calculation, state store or schedule is introduced.
- Concatenate the existing widget stylesheets into one desktop build asset, preserving their order and relative font URLs. No UI redesign.
- Coalesce construction and ignore outdated/repeated timing callbacks. Compatibility and floating renderers explicitly resume if they take over a suspended panel.

The already-transitive `webview2-com` binding is now an explicit optional dependency; package versions and the installed WebView2 runtime are not upgraded by this change. `TrySuspend` is best-effort, with runtime interface checks and ordinary warm retention/expiry as the fallback. Microsoft's [TrySuspend/Resume reference](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_3) describes the hidden-controller requirement and renderer resource policy. No Windows 11-only API is added; actual Windows 10 execution remains unverified.

## Memory and CPU tradeoff

Entire Sahib QA process tree, including all descendant WebView2 processes:

| Collapsed state | Summed working set | Private resident | Private commit | CPU, machine total |
|---|---:|---:|---:|---:|
| Before, panel destroyed | 86 MiB | 17 MiB | 62 MiB | 0.049% |
| Reuse without suspension, intermediate prototype | 460 MiB | 110 MiB | 259 MiB | 0.118% |
| Final suspended warm cache | 361 MiB | 84 MiB | 259 MiB | 0.081% |
| After idle eviction, native only | 85 MiB | 15 MiB | 60 MiB | 0.033% |

The warm cache costs about **67 MiB additional private resident RAM** and about **197 MiB additional private commit** until eviction. Suspension reduced the prototype's resident cost, but does not eliminate allocation. Summed working sets can double-count shared DLL/runtime pages; private commit is allocated virtual memory, not resident RAM. The warm memory cost is temporary when only the compact widget remains in use. With the full main app visible, the panel stays ready alongside that already-running WebView environment.

CPU differences here are small: approximately 0.03 percentage points of this machine between destroyed and suspended caching. Samples span 10–15 seconds and include the QA-only file-control poller in both configurations. They are not long-session leak measurements or a promise of identical Task Manager figures on every PC.

## Verification and reproduction

- 21 Rust tests passed, including scheduling/focus policy and stale/repeated timing record guards.
- Actual optimized Tauri lifecycle checks passed: hidden startup preload, first prewarmed open, main responsiveness, suspension, same-document reuse, current location/running timer hydration with the main destroyed, compatibility compact and floating transitions, cache expiry, native-only process-tree recovery and correct cold recreation.
- Expiry regression uses a QA-only shortened 5-second lease to exercise the same code path. Production uses 60 seconds. Background-only benchmark samples before first opening contained only the native host.
- Existing native widget/timer/audio regression is run separately; microphone/speaker onset is not measured by these markers.

Run `node tools/measure-panel-open.mjs --release` for the five-open timing/resource protocol and `node tools/verify-panel-lifecycle.mjs --release` for lifecycle assertions. Both build and verify a separate QA identity by default; `--skip-build` requires a previously built matching QA binary. Reports and profiles stay under `.qa/`. They never connect to the installed user profile.

The latest bounded timing record is also available through `SahibDesktop.invoke('desktop_state').then(s => s.panelTiming)` in the main application's diagnostic context. It includes cold/warm classification, first-after-startup status, construction/navigation/show/hydration/ready/paint markers and document-relative CSS/JS timings. Timing does not write a new log each second.

No main merge, production installation, updater, UI redesign, prayer calculation or scheduling change is part of this refinement.
