# Native taskbar host candidate

Publication update: [v0.2.5 is released](https://github.com/Nobodyssssy/sahib/releases/tag/v0.2.5), from source `4ebf077d9d46b915bd37b8c20b378cd91e1227f4` on `codex/windows-tauri`. The versioned installer is 23,136,919 bytes, SHA-256 `2a8026ea83509ab65ed6f8848a876d1cb935ca525293767ab0a75baf02f3c872`; the published download was verified against the local file. See [release notes](releases/v0.2.5.md). Main remains unchanged. The candidate notes below retain the original implementation/testing history; publication was subsequently explicitly authorized by the user.

Local branch: `codex/taskbar-shell-identity`, based on `9fad2c6`, retaining shutdown fix `19291d2`.
Work continues in `C:/Users/Protagonist/Sahib-Taskbar-Research`; the original repository, installed app/profile, main and verified backup are not modified.

## Implementation

- A separately created Win32 `WS_CHILD` drawing surface is hosted by the selected Explorer taskbar. A hidden Tauri anchor retains application window ownership. The existing Tauri HWND is never reparented. Explorer can destroy the drawing surface without delivering Tauri's last-window exit path; the existing watcher reacquires the host and recreates the surface.
- Creation temporarily matches the parent's DPI awareness context, restores the thread context, and converts physical screen positions to parent-client coordinates. Each monitor retains its own scale, bounds, clipping region and native text. The compact card has a small taskbar inset; its design and all existing layouts remain available.
- A bounded, cached UI Automation query measures interactive taskbar controls on the existing non-UI worker. Native children from other processes are also excluded, including other embedded widgets. Placement finds the nearest clear gap to the saved left/right/manual position. It never resizes Explorer's controls or reserves desktop work area. A crowded, unavailable or unmeasurable host uses a correctly sized compact fallback in the work area.
- Monitor-local fullscreen hiding and auto-hide remain authoritative. The verified Explorer PID classifier remains in place. Embedded windows follow the taskbar's own order; the former topmost overlay lifting is unnecessary. Expanded panels continue using their existing separate WebView and now anchor to the actual compact location.
- Query results are plain geometry, with no COM interface in shared state. Queries are coalesced, cached and performed outside the UI thread; connection/transaction timeouts are configured. No new worker, timer, runtime package, Explorer-loaded DLL or reservation helper is introduced.
- Raw windows are created/destroyed on the UI thread. Parent loss disconnects accessibility and releases fonts. Controller destruction also destroys its owned drawing surface. Explicit exit destroys remaining surfaces before the accepted painting-thread graphics teardown. Existing worker drain, hook ownership and shutdown gates remain authoritative.

## References and scope

MangoDisk v1.2.2 informed the separation of hosting, placement, fullscreen and host-loss lifetimes. No GPL implementation, DLL or dependency was copied. Its more invasive reservation/XAML adapter is not introduced; this candidate uses measured free space and an explicit fallback.

Awqat-Salaat's [native host](https://github.com/Khiro95/Awqat-Salaat/blob/master/AwqatSalaat.WinUI/TaskBarWidget.cs) uses a WinUI/XAML island; its [documented crowding and positioning limitations](https://github.com/Khiro95/Awqat-Salaat#limitations--known-issues) informed the collision/recovery checks. Sahib retains its lighter existing GDI/DirectWrite rendering; no Awqat implementation is imported.

Windows contracts: [CreateWindowEx](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-createwindowexw), [thread DPI context](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setthreaddpiawarenesscontext), [UI Automation threading](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading), [UIA timeouts](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nn-uiautomationclient-iuiautomation2).

## Verification

Completed on Windows 11 build 26100, with two physical monitors at 125% and 100%. All builds and runtime suites were serial; compilation used one worker.

| Check | Result | Local evidence |
| --- | --- | --- |
| Final locked optimized Rust library suite | 30 passed | Includes real child lifetime, coordinates, DPI inheritance, gap selection and fallback sizing |
| Native application acceptance | 39 passed | `.qa/taskbar-widget-1793700189271/report.json` |
| Actual Explorer restart | Both surfaces recreated under the new Explorer PID | `.qa/taskbar-widget-1793699456461/report.json` |
| Final presentation and cleanup | 39 passed | `.qa/native-host-presentation-1793700720994/report.json` |
| Final optimized shutdown matrix | All 14 cases exited zero | `.qa/shutdown-1793700476919/report.json` |
| Final panel lifecycle | All 8 checks passed | `.qa/panel-lifecycle-1793701192319/results.json` |
| Resource/catalog integrity | Passed | 57 scripts, 82 HTML resources, 116 precache assets, 70 books / 67 available downloads |

Native acceptance checks actual child style/parent, physical HWND DPI, visible painting and hit tests, ordinary maximized versus fullscreen windows, monitor-local hiding, native click/Space, Start, auto-hide hover, crowding/fallback and re-embedding. Start leaves the exact parent and bounds unchanged on both displays; there is no native shell lifting. The presentation matrix reviews all four primary layouts in English/Arabic and light/dark, shared right-click/F10 menus, and primary/all monitor switches with exact native-child counts.

Light-mode text is explicitly near-black, including the large Countdown Focus digits; secondary labels are dark gray. A missing Windows compatibility manifest initially produced blank layered children despite successful structural tests. The final executable declares Windows 10 compatibility while retaining Common Controls, and actual screenshots verify painting. An if-let mutex lifetime across panel operations and asynchronous monitor-pruning cleanup were also corrected and rechecked.

Final steady native-only sample: **71.56 MiB summed working set, 18.84 MiB private resident, 64.22 MiB private commit and 0.425% system CPU** over 35.8 seconds on this active desktop. No WebView descendants remained. The pre-change fixture averaged 65.78 MiB working set and 0.165% CPU in a shorter sample; this does not establish a CPU speedup, and other desktop activity/sampling length differ. The integration adds about 6 MiB working set in these samples. No zero-cost or long-term performance guarantee is claimed.

The panel harness explicitly foregrounds the QA application before opening: a background file-triggered request can otherwise be refused foreground by Windows and normal focus dismissal closes its debug connection. No production dismissal behavior was disabled.

Actual Windows 10 execution, physical unplug/replug and an actual OS restart remain unperformed. API compatibility and geometry tests are not substitutes for those checks. No merge, push, installed-app replacement or publication occurred.

## Local installer

- Implementation: `cee04442f1a7f7cacd72e8296d5f56177791f127`.
- Separate normal/default-feature installer: `releases-local/0.2.4-taskbar-host-20261103/Sahib_0.2.4_x64-setup.exe`.
- Size: 23,134,457 bytes. SHA-256: `11b0ca76f12af1aa4107af3d57e0460326b894ee2a502365d28bf81e29f6f533`.
- Unsigned. Production identity/defaults, all nine approved executable icon resolutions, installer icon/header, embedded Windows compatibility/Common Controls manifest and copied checksum passed.
- The installer was not run. Installer upgrade behavior and the normal installed profile were not exercised; runtime acceptance used the separately preserved optimized QA executable, SHA-256 `f494c94022017b2636f175e0ab753478529cfe23e7e1fb7212cbf566b4468807`.
- `BUILD-INFO.json` beside the installer records source and evidence provenance. Original repository/installer, application data, main and the E: backup remain unchanged.
