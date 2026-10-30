# Windows compatibility and acceptance — RC5 audit candidate

The host tested was Windows 11 IoT Enterprise LTSC x64, build 26100. Windows 10 22H2 was **not run**; source/API review is not certification on that OS.

Confirmed fixes:
- Recognize vertical taskbars when selecting the existing floating fallback. Previously the WebView fallback could wait indefinitely after a horizontal-to-vertical taskbar change.
- Rebuild the native widget clipping region after DPI changes even when Windows has already resized its HWND. Actual RC4 clipped the countdown at 150%; RC5 client/region bounds matched at 150%, 200% and restored 125%.

Actual acceptance: S3 suspend/resume, timer completion chime and popup, lock/unlock widget recovery, and Narrator prayer/time/countdown were confirmed by the user. The real Sion Maghrib alert on 2026-10-30 at 17:19 was observed in the alert ledger 308 ms after its deadline; audio was confirmed by the user. The ledger stores scheduled timestamps, so it does not measure audio onset or prove zero dispatch delay. Original application and RC profile were restored after testing.

The reviewed DirectWrite Factory5 requirement starts at Windows 10 build 15063, below 22H2. DPI awareness, UI Automation, GDI window regions and classic tray APIs are supported. No application dependency requiring Windows 11 was identified. The PE import audit checks a limited explicit API list; it cannot establish compatibility of every dynamic call or dependency.

Sources: [DirectWrite](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_3/nn-dwrite_3-idwritefactory5), [DPI awareness](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setthreaddpiawarenesscontext), [Tauri Windows installer](https://v2.tauri.app/distribute/windows-installer/), [WebView2 support](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-supported-operating-systems).

Still requires an actual Windows 10 22H2 installation: installer and fresh WebView2 setup, Start/Search interactions, left/right/top/bottom taskbars, auto-hide, Explorer restart, notifications, tray, fullscreen recovery, monitor hotplug, negative coordinates and 100–200% scaling. Actual OS date rollover and virtual-desktop switching also remain manual tests. Current-user NSIS downloads WebView2 when missing; first installation is not fully offline.

## Distribution hold

RC5 is unsigned, local and unreleased. No trusted signing certificate was available; choose trusted Authenticode signing before production distribution. Sahib has no automatic app updater. WebView2 Evergreen updates its runtime, not Sahib. Future app updates require a replacement installer.

Reserved-rights Al-Qatami recordings remain bundled as previously requested, with rights notices, but redistribution permission is unverified. Vendored EmbedPDF/PDFium version-pinned notices, other recording provenance and bundled-content permissions require completion before public distribution. Availability online does not establish redistribution rights. Font OFL notices are retained. Do not describe this candidate as distribution-ready.

Local RC5 installer SHA-256: `e4bea0dbe24c83732d5b5f10f57c9051b74046e4694fd9a79ec65acfb8836086` (23,060,965 bytes). No production release or main merge.
