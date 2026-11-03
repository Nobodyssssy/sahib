# Taskbar architecture review and first experiment

The initial classification-only experiment below is retained as history. Native hosting is now implemented in the isolated continuation; see [the native host report](WINDOWS-TASKBAR-HOST.md) for current scope and acceptance. Earlier missing-linker/no-binary statements are historical.

Date: 2026-11-02. Source baseline: 9fad2c6 (includes accepted shutdown fix 19291d2).
Workspace: C:/Users/Protagonist/Sahib-Taskbar-Research.
Branch: codex/taskbar-shell-identity. Local experiment only; no publication or installer.

## Comparison

| Concern | MangoDisk v1.2.2 | Sahib baseline |
| --- | --- | --- |
| Native hosting | Creates a native WS_CHILD surface under the selected Explorer taskbar; Windows 10 normally uses its rebar. Detects lost/replaced parents and recreates the child. | Tauri-owned top-level native window, GDI/DirectWrite painting, no compact WebView. Topmost order recovery can temporarily lift it away from Start/Search. It is an overlay, not an embedded taskbar item. |
| Taskbar space | Separate unelevated companion owns a reversible reservation lease. Windows 10 resizes the task-button container with identity/original/applied checks. Windows 11 uses an architecture-matched XAML adapter. Unsupported/shared hosts fall back to measured free gaps. Pipe closure releases the lease, and a completion barrier prevents overlapping reservations. | Reads taskbar and notification-area bounds, applies offsets/clamping, but does not reserve task-button space. Icons can collide with the overlay. An appbar would reserve desktop work area, not a slot within Explorer's existing bar. |
| Fullscreen | Uses foreground identity, geometry/frame classification and verified desktop/preview/flyout exclusions; coalesced foreground events and timer fallback. | Enumerates visible windows so fullscreen on an unfocused monitor still hides that monitor's widget. Uses client coverage, excludes own/minimized/cloaked/click-through/nonactivating windows. Desktop/taskbar exemptions originally trusted class names; Explorer preview host was not recognized by ownership. Keep monitor-wide enumeration in future changes. |
| DPI | Matches parent thread/window DPI context before child creation; uses physical rectangles and parent-client conversion, including clipping/regions. | Tauri monitor scale, physical position/size, independent region tracking. Earlier 150/200 percent clipping correction already exists. Parenting a live Tauri popup across DPI contexts is not a safe shortcut. |
| Multiple monitors | Enumerates stable display identities, validates Explorer taskbars, handles auto-hide registration and missing bars; reservation has host restrictions rather than universal secondary-bar support. | Supports primary/named/all monitors and per-monitor scale/offset. Rediscovers primary/secondary bars by bounds; vertical/no-space cases use a floating fallback. Hotplug acceptance remains pending. |
| Explorer recovery | Rebuilds native child when Explorer destroys its parent, releases old reservation and reacquires current geometry/lease. | Surviving independent overlay hides during rebuilding and repositions when taskbars return. Existing hooks plus watchdog drive recovery. |
| Resources/shutdown | Bounded model/wake messages, native painting, foreground subscription, companion restoration ownership. | Existing bounded event channel, watchdog, owned/drained workers and painting-thread COM release. Preserve these accepted shutdown rules. No added thread/timer/helper/cache in this increment. |

## Recommended implementation sequence

1. Correct shell identity classification independently (this candidate). Keep prayer data, rendering, panel and accepted teardown unchanged.
2. Add an opt-in, separately owned native child host at creation, matching Explorer's DPI context. Keep the expanded panel a top-level Tauri WebView. Do not reparent the existing Tao/Tauri HWND: Explorer destruction must not become an app-last-window exit or bypass graphics release. Model host loss separately from application shutdown; disconnect callbacks and destroy native resources on their owning thread. Shutdown gates must win over every recovery path.
3. Initially place the embedded child only into a measured, unobstructed gap; hide/fallback when no gap is available. This gives actual embedding without changing Explorer layout. Preserve the existing compact dimensions/design and per-monitor fullscreen checks.
4. Evaluate an independently written reservation helper separately. Windows 10 container resizing and Windows 11 XAML reservation are different mechanisms; neither is a small portable change. Use reversible leases, identity checks, pipe-death restoration and serialization. Avoid adding an Explorer-loaded component to the first experiment. Treat unsupported OS/shell configurations as fallback, not success.
5. Require Windows 11 and real Windows 10 22H2 runtime acceptance before promotion: both displays/DPI transitions, icon crowding, Start/Search/previews, fullscreen with focus on another monitor, auto-hide, Explorer restart, hotplug, renderer switching, repeated Quit, session cancellation and actual reboot. Measure native idle process tree and CPU before/after using identical release builds.

## Candidate change

Only src-tauri/src/taskbar.rs changes runtime behavior. It verifies the current primary taskbar's PID before exempting recognized Explorer desktop/taskbar/preview windows from fullscreen. Matching classes in other processes and unavailable/zero ownership do not receive the exemption. Taskbar PID is queried live so no process identity survives an Explorer restart. Non-shell classes return before owner lookups. Start/Search executable validation and client-area fullscreen classification remain intact. Preview recognition is limited to fullscreen exclusion; it does not trigger a new Start/Search lifting policy.

Two tests cover the class/PID matrix (including changed/absent Explorer, application classes, negative cases) and a null native handle. Existing geometry tests remain. No new dependencies or GPL source were imported. This is independently authored Win32 identity validation informed by architecture, not a port of MangoDisk code. The broader integration goal is NOT complete: this candidate remains an overlay and reserves no taskbar space.

## Verification actually performed

- Host OS reports Windows NT 10.0.26100.0 (Windows 11 build 26100).
- Rust taskbar module plus test bodies type-checked successfully with rustc --edition 2021 --test --emit=metadata. This performs no link and executes no tests.
- The same taskbar module/test bodies also compiled successfully to a Windows object file with rustc --edition 2021 --test --emit=obj. No linking or test execution occurred.
- Rustfmt and git diff --check passed.
- node tools/verify-release.mjs passed: 57 scripts, 82 HTML resources, 116 precache assets, zero failures; catalog remains 70 entries / 67 downloads.
- cargo test --locked --manifest-path src-tauri/Cargo.toml FAILED before application compilation: linker link.exe not found. The local Visual Studio 18 directories have no compiler installation; SDK library directories are also missing from the inspected SDK tree. No toolchain/system install was attempted. Backup lockfile content is preserved (byte differences were checkout line endings).
- No candidate application binary exists. Native runtime regression, preview reproduction, full unit-test execution, release shutdown matrix, expanded-panel lifecycle, Explorer restart, DPI and CPU/memory comparison could not be run. Historical passes in DEV_STATE.md belong to the baseline and are not evidence for this candidate.
- Windows 10: the change uses existing User32 APIs supported before Windows 10, adds no Windows 11 dependency, and leaves vertical fallback unchanged. This is API/source assessment only; no Windows 10 execution occurred.
- No installed app, profile, stable installer, backup source or main branch was changed. No push, merge, release or publication.

## Remaining work

Restore Visual C++ Build Tools with the Windows SDK, open its x64 developer environment, then run the locked unit tests. Build an isolated optimized QA executable (com.sahib.companion.qa) through tools/desktop-qa-session.mjs and run current verify-shutdown.mjs and verify-panel-lifecycle.mjs with --release --skip-build. Add targeted real Explorer-preview and unrelated same-class fullscreen fixtures before accepting this classification change. The older native-prototype harness contains a stale immediate-panel-unload expectation; adapt that assertion to the existing lease before treating its full report as an acceptance gate. Do not promote this unlinked candidate.

## Reference sources (architecture only)

All MangoDisk files inspected at tag v1.2.2, under src-tauri/src/resident/taskbar_display:

- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/native.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/hosting.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/reservation.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/reservation_windows.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/reservation_xaml.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/monitors_windows.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/visibility.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/native/foreground.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/native/update.rs
- https://github.com/harry0703/MangoDisk/blob/v1.2.2/src-tauri/src/resident/taskbar_display/shell_events.rs

Win32 API contracts:

- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent
