# Windows shutdown candidate — 2026-11-01

Branch: `codex/windows-tauri`. Review baseline: `9530696`. Do not merge to main until actual Windows shutdown/restart acceptance is complete. No error-dialog suppression, exception swallowing, production installation, profile migration, public Release or tag is part of this change.

## Findings and correction

| Risk | Finding and resulting behavior |
| --- | --- |
| Blanket `ExitRequested(code=None)` veto | Locked Wry 2.12.3 emits this event when its last window is destroyed. Locked Tao 0.37.1 handles confirmed `WM_ENDSESSION` separately, through loop destruction and `process::exit`. The veto was therefore not proof of a Windows session veto. It is now limited to deliberate idle WebView retirement. Ordinary close-to-tray retains the app; explicit quit and other real exits drain workers. |
| Unbounded widget-monitor worker | A shared gate stops recovery and rejects queued UI work. The worker owns its join handle, notices disconnection, and checks shutdown during its bounded wait/debounce. Native monitoring creation runs on the UI thread. Normal exit drains monitoring and scheduler workers off the UI thread, while the event loop keeps pumping in-flight calls. |
| Unowned WinEvent message thread | An owned `Watch` initializes its message queue before publishing its thread ID. Stop posts `WM_QUIT`; the creating thread unregisters every installed hook after `GetMessageW` returns zero or an error, and the owner joins it. Callbacks ignore work during shutdown. Session exit joins only the hook thread, which has no dependency on UI dispatch. |
| Session query precedes confirmed termination | A subclass of Tao's persistent event-target HWND pauses recovery on `WM_QUERYENDSESSION`, resumes on canceled `WM_ENDSESSION`, and permanently gates work on confirmed termination before Tao's handler runs. This also works with no application windows. The class lookup is a dependency on the locked Tao implementation; startup fails explicitly if it cannot install the handler. Review it when upgrading Tao. |
| Reproduced graphics teardown exception | Worker fixes alone still produced exit code 2170 (`0x87a`). The exception observer recorded DXGI/Direct2D addresses followed by `LdrShutdownProcess`/`ExitProcess` among raw stack candidates. The native text engine retained graphics COM objects in thread-local storage until process-detach destruction. `RunEvent::Exit` now releases them on the painting thread before process exit; drawing cannot recreate the engine while quiescing. The same reproduction then exited successfully. |

The installed-app Application log independently contains `0x0000087a` in KERNELBASE.dll and separate `0xc000041d` failures. A faulting module alone does not identify a source-level cause. The diagnostic observer continued exceptions as unhandled; it did not suppress them. Its output is a stack-memory candidate scan, not a symbolized stack unwind.

## Verification

- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 24 passing tests, including real hook installation, explicit thread termination, hook release, idempotent stop and ignored callbacks after stop.
- `node tools/verify-shutdown.mjs --release --skip-build`: 14 passing isolated release-mode scenarios. Native/open, native/tray, native/headless, unload/open, unload/tray, keep/open and keep/tray each passed both explicit quit and targeted session termination, with query/cancel checks first. Every process exited with code zero. Report: `.qa/shutdown-1793523636575/report.json`.
- `node tools/verify-panel-lifecycle.mjs --release --skip-build`: all 8 current warm-lease/suspension checks passed, including cold reopen, timer restoration, web fallback, floating mode and native-only idle process tree. Report: `.qa/panel-lifecycle-1793523826136/results.json`.
- Resource checks and production identity/default-feature/icon/license checks passed.
- The older `verify-native-lifecycle.mjs` run passed its 46 application checks and active-session/PDF/draft retention checks, but failed its immediate native-restoration unload assertion, then timed out in the keyboard sequence. Its immediate-destruction expectation differs from the existing warm lease. The later timeout is not established as resolved. Report: `.qa/native-lifecycle-1793523714940/report.json`. This is not a full compatibility-suite pass.

GUI tests require the normal Windows desktop outside the restricted sandbox. Sandbox runs could not connect to WebView2 and are not acceptance evidence. Tests used `com.sahib.companion.qa` and isolated profiles; the installed application/profile was not modified.

Verified QA executable SHA-256: `8873a373da6512c049704a12ff61e297595fb11bafa7a0f7f3a2194533f0403e`. A copy is retained under `.qa/shutdown-verified/` while packaging the ordinary production configuration.

## Remaining gate

Targeted `WM_QUERYENDSESSION`/`WM_ENDSESSION` messages exercise the application's session path without shutting down Windows. They do not reproduce the full operating-system shutdown environment. Actual shutdown/restart, including the user's installed environment, remains the final acceptance gate. Keep main unchanged until this passes and the observed crash is confirmed resolved. Existing distribution-clearance gates remain independent of this local build.

## Local installer candidate

- `releases-local/0.2.4-shutdown-rc-20261101/Sahib_0.2.4_x64-setup.exe`
- 23,122,718 bytes; SHA-256 `9fb4cc3ef843e7850c4f140e20b97a0e3c6cbdf2b6ef9504fed875c185cb17f2`.
- Ordinary Sahib / `com.sahib.companion` / 0.2.4 configuration, default native features, unsigned (`NotSigned`). Product/file metadata, all nine executable icon resolutions and embedded installer artwork passed verification. The copied candidate hash matches the build output. Existing `releases-local/0.2.4` installer remains unchanged.
- The normal release compilation passed. Restricted packaging could not resolve the NSIS download host; Tauri's supported `bundle --bundles nsis` succeeded outside the sandbox against that already-built executable. It warned that the bundle marker was already absent after the first attempt patched it; no updater plugin is configured. No runtime workaround or error-dialog suppression was added.
- Candidate was built and verified locally, not installed or publicly uploaded. QA binary and production binary differ in identifier and QA-only controls; runtime validation used the isolated release-mode QA variant, packaging validation used the ordinary production build.
