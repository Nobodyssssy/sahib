# Windows v1.0 roadmap and CachyOS/Arch plan

## Windows v1.0 — status
| Phase | Scope | Status |
|---|---|---|
| 0 | Authoritative source, data protected | Done: working clone outside the backup, branch `design/desktop-v2`; installed app/profile untouched (one process, PID unchanged) |
| 1 | Native bugs 2, 3, 4 | Done and live-QA'd (11/11). Bug 1 hardened, **not reproduced**; Bug 5 logic verified, symptom **not reproduced** |
| 2 | Desktop design system: shell, header, tokens, type floor, focus | Done in `css/desktop-v2.css`; Sol critic scored the baseline and the preview 6/10 (screenshots only) — not re-scored after the final pass |
| 3 | Home phase scenery, rhythm chart, nav arrows, Tasbih keyboard, RTL sidebar | Done and visually checked at 1920×1080 (EN/AR); 1280×720 only partly |
| 4 | Practice + history, PDF reader | Audit only. Needs a data-populated review |
| 5 | Settings compaction, toast actions, Settings modal width | Not started |
| 6 | Physical acceptance: DPI 100–200 %, sleep/resume, reboot, fullscreen game, Narrator, both monitors | Not done |
| 7 | Release | Blocked by distribution clearance (Adhan audio, Names audio, vendor notices) and no code-signing; no installer built, nothing published |

Order of remaining work: (1) physical test of Bugs 1/3/4 on the installed build via a QA build of this branch; (2) Practice history review; (3) PDF reader audit; (4) toast actions decision; (5) Settings; (6) full acceptance; (7) release only when clearance exists.

## Linux (CachyOS / Arch) — plan, no implementation
Start only after Windows v1 is stable.
- **Runtime**: Tauri v2 on WebKitGTK (`webkit2gtk-4.1`, `gtk3`, `libayatana-appindicator`), Wayland and X11. The UI layer (`desktop-v2.css`, logical properties, per-phase vector scenes) is renderer-agnostic.
- **Portable Rust now**: `audio` (rodio over PipeWire/PulseAudio compatibility), `scheduler`, `session_timer`, `placement::centered`, most of `lib.rs`. **Windows-only, to isolate behind a trait/cfg**: native widget, native text, accessibility, taskbar host (and verify `taskbar`, `widget_watch`).
- **Widget alternative**: no taskbar child windows on Linux. Use the tray icon with a countdown tooltip/menu plus notifications; optional later: KDE Plasma plasmoid or GNOME Shell extension. Wayland forbids client-side global positioning, so the floating widget is X11/Xwayland only.
- **Notifications**: freedesktop notifications via the plugin (actions work there, unlike the Windows plugin) — the Dismiss/Stop/Restart design is easier on Linux.
- **Window placement**: compositors own placement on Wayland; `placement::centered` applies on X11 only, request centring via the window builder on Wayland.
- **Autostart/sleep**: XDG autostart entry; suspend/resume via logind signals (`org.freedesktop.login1.PrepareForSleep`) to invalidate the schedule like `sahib:clock-changed`.
- **Storage**: XDG data dir (`~/.local/share/...`), existing IndexedDB lives in the WebKitGTK profile.
- **Fonts**: bundled Amiri/Tajawal/Inter (OFL) render the same; check `fontconfig` fallbacks for Arabic.
- **Packaging**: AUR `PKGBUILD` first (system WebKitGTK), Flatpak second (portals for notifications/autostart), AppImage last (WebKitGTK bundling is fragile).
- **Prerequisite**: the same audio/redistribution clearance as Windows.
