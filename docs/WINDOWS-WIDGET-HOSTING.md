# Windows widget hosting decision — 0.2.2

Status: keep the improved independent Tauri overlay for this preview. No Explorer parenting or companion executable has been introduced. A native taskbar host remains a separate architectural option, not a promise that an unsupported integration will be universally reliable.

## What the reference actually does

The inspected Awqat Salaat files are [TaskBarWidget.cs](https://github.com/Khiro95/Awqat-Salaat/blob/master/AwqatSalaat.WinUI/TaskBarWidget.cs), [TaskBarManager.cs](https://github.com/Khiro95/Awqat-Salaat/blob/master/AwqatSalaat.WinUI/TaskBarManager.cs), and [TaskbarStructureWatcher.cs](https://github.com/Khiro95/Awqat-Salaat/blob/master/AwqatSalaat.WinUI/TaskbarStructureWatcher.cs).

Its compact view lives in a native host window containing a WinUI DesktopWindowXamlSource. It calls SetParent to attach that host to the selected Explorer taskbar. The code's “InjectIntoTaskbar” name describes window parenting; it is not evidence of DLL injection. A UI Automation watcher observes taskbar structure and geometry, coalesces event bursts, and waits briefly for taskbar animations to settle. Its manager handles taskbar creation, display changes and host destruction, deliberately recreating the host when necessary. It also contains compatibility handling for a third-party taskbar replacement, illustrating the maintenance cost of relying on shell implementation details.

Those choices can make the widget follow taskbar stacking/visibility more naturally than an unrelated top-level window. Source inspection alone does not prove reliability across every Windows 11 build.

The repository's [source license](https://github.com/Khiro95/Awqat-Salaat/blob/master/LICENSE) is MIT, Copyright (c) 2023 Khiro. Sahib's implementation here is original Win32/Tauri code, with architectural comparison rather than copied source. The existing bundled Adhan recordings retain their separate rights notices; the source-code license is not treated as a recording license.

## Options

| Consideration | A: event-observed independent overlay | B: dedicated native compact host attached to Explorer |
| --- | --- | --- |
| Main application | Tauri v2, unchanged | Tauri v2, unchanged |
| Compact UI | Existing WebView per selected taskbar | Native text/icon painting in one small companion process |
| Expanded UI | Tauri panel | Retain a Tauri panel opened by the companion |
| Recovery | Out-of-context window events, actual visibility/coverage observations, conditional non-activating ordering, slow safety audit | Observe host/Explorer destruction; rediscover taskbars, recreate and reparent native children |
| Reliability evidence | Reproduced old failure and actual Windows regression/visibility test; see verification report | Not implemented or benchmarked; no claim of superior measured reliability |
| RAM/CPU | Reuses the current runtime; measured with WebView descendants | Could remove compact WebView costs, but adds IPC/lifecycle work; actual memory and CPU must be measured in a prototype |
| DPI/monitors | Per-monitor physical geometry; independent top-level windows | Cross-process parenting requires careful DPI isolation and physical-coordinate handling |
| Complexity | Small Windows-only module in existing Rust host, no new runtime/process | Additional executable, IPC protocol, permissions, installer/startup ownership, recovery and version compatibility |
| Windows compatibility | Documented observation/window APIs; no guarantee of priority over all protected shell surfaces | Depends on Explorer window/class/child behavior, which is not a formally supported third-party taskbar widget API |
| Virtual desktops | Cloaking is observed and not forcibly overridden; full switching matrix remains unverified | Taskbar association may help, but is not assumed to solve virtual desktops until actually tested |

## Why the 0.2.2 change chooses A first

On the previous build, an actual Explorer taskbar was promoted above Sahib. The widget remained valid, visible and topmost, but physically covered. It stayed covered beyond the old geometry watchdog. The fault therefore did not require a different UI framework: “topmost” is a category, not proof that a window is above the taskbar at that moment.

The preview now observes native events outside other processes, checks actual hit-testing and z-order, and only repairs a demonstrated taskbar coverage/lost-topmost case. Genuine fullscreen and borderless client coverage suppress the widget before any repair. A ten-second safety audit covers missed events; it is not a timer that repeatedly forces topmost. The current theme, countdown, settings, schedule and audio contracts remain in the Tauri host.

## If a native companion is chosen later

Use a separate, minimal Windows process for compact windows only, rather than reparenting the Tauri/WebView process into Explorer. Keep the authoritative schedule, preferences, deduplication and audio in Sahib. Send a bounded presentation packet and whitelisted user actions over a current-user-restricted IPC channel. The companion should exit when its owner exits, handle Explorer/taskbar reconstruction, retain per-monitor positions, and report its own visibility observations. It must never calculate a second prayer timetable or inject a DLL/patch into Explorer.

A native compact host alone would not make WebView2 disappear: the current main window remains loaded when hidden. Achieving runtime use only when the main or expanded UI is open also requires explicitly unloading/recreating those interfaces, while preserving their browser data and leaving native alerts operational. No such lifecycle change is included in 0.2.2.

Before shipping that option, prototype it behind a setting and compare both implementations on Explorer restart, virtual desktops, Win+D, games/video, sleep/resume, monitor hot-plug and DPI changes. Measure total process-tree memory, idle CPU, startup/recovery latency and native operations. Keep a floating fallback and an explicit way to disable the integration. No decision to ship such parenting is made by this preview.

## Windows API references

- [SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos): topmost ordering and SWP_NOACTIVATE.
- [SetWinEventHook](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook): out-of-context callbacks, no DLL mapped into the observed process, and message-loop requirements.
- [WinEvent constants](https://learn.microsoft.com/en-us/windows/win32/winauto/event-constants): foreground, structure, location and cloaking observations.
- [SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent): child/popup style responsibilities and cross-process DPI-awareness risks. A documented parenting function does not make Explorer's private taskbar hierarchy a supported extension contract.
