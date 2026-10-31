# Sahib 0.2.4 targeted corrections

Branch: `codex/windows-tauri`. Main and the live PWA are unchanged. Normal unsigned installer; no profile, database identifier or version change.

## Changes

- Library actions reflect actual availability: Read for local/cached PDFs, approved Download, Import my PDF, and Official source where supplied. A private PDF can attach to the existing catalog ID without resetting bookmarks/progress or duplicating the catalog entry. Existing personal imports and cached PDFs remain readable. Known download restrictions are handled before network calls. No approval bypass.
- Shared Windows fullscreen detection checks visible monitor coverage independently of foreground focus. It excludes minimized, cloaked, shell, Sahib-owned and transparent/non-activating overlay windows. Client-area coverage avoids treating ordinary maximized windows as fullscreen. Existing polling, taskbar positioning, scheduling and floating behavior are unchanged.
- Activating the native compact widget again on the same monitor closes its expanded panel. Mouse, Enter/Space and accessibility Invoke share this behavior; programmatic alert/timer opens still open, and warm reuse remains intact.

## Verification

- 24 isolated actual Tauri/WebView2 library checks across restart, including canonical IDs, bookmarks/progress, private attachment/replacement, Arabic actions, cached/personal PDF reading and known restrictions without network requests.
- Catalog validation: 70 stable entries, zero approved downloads, existing reading order/encoding/rights gates intact. Release resource checks pass.
- Five focused native tests cover per-monitor coverage, maximized/auto-hide gaps, vertical taskbars, negative coordinates and scaling.
- Actual fullscreen game on monitor 1: both native and WebView fallback hide on that monitor, remain visible on monitor 2, and stay hidden on monitor 1 when an application on monitor 2 receives focus.
- After fullscreen ends/minimizes, both renderers restore. The shared detector reports no occupancy with a normal maximized browser. A first attempt only covered the game; that sample is not a restoration pass.
- User physically confirmed the second compact click closes the expanded panel. Injected automation activates the compact window first, so its focus-loss/reopen sample is not evidence for physical toggle behavior.
- Existing hardware configuration: primary 2560×1440 at 125%; secondary 1920×1080 at 100%, negative X coordinates. Secondary-monitor fullscreen, actual Windows 10, Start/Search and taskbar auto-hide remain manual regression checks; they were not rerun in this targeted pass.

`tools/fullscreen-probe.rs` compiles the actual shared module with `rustc --edition 2021 --test tools/fullscreen-probe.rs -o .qa/fullscreen-tests.exe`. Without `--test`, the probe accepts monitor `left top right bottom` or `--foreground`. `tools/verify-fullscreen-live.mjs --release` uses an isolated QA profile and `.qa/fullscreen-displays.json` (array of `{name,left,top,right,bottom}`); its command/response files record user-controlled focus/fullscreen transitions. No game windows are moved or manipulated by the harness.

Installer identity, approved embedded icons and SHA-256 are verified after the normal `npm run desktop:build`; current artifact details are recorded in the production guide and ignored local verification record.
