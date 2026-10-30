# Development state

Branch: `codex/windows-tauri`. Do not merge into `main` yet.

## Decisions

- Keep Tauri for the full application and rich panel; use the native compact widget only in the separate 0.2.4 RC. Retain the selectable WebView fallback.
- DirectWrite renders bundled Tajawal Arabic; Segoe UI handles Latin/numeric labels. No additional Noto family is packaged.
- Forest/peach icons derive from the existing inline Amiri صاحب logo. User approved the final artwork on 2026-10-30. No production build or main merge is authorized.
- Daily Adhkar counts reset at the local calendar date boundary. Synchronize live counters as well as IndexedDB; recheck on focus, visibility, active use and every 30 seconds while visible.
- Morning/evening home practice shortcuts open the corresponding Adhkar collection directly.
- Add three compact designs, an optional hh:mm display, and a persisted native session timer. Focus mode suppresses other Sahib reminders but allows prayer-time Adhan. It does not control Windows or other apps.

## Verification and open work

- Earlier 0.2.4 checks: release native regression 32/32; lifecycle 66/66; typography 17/17. Actual RC1→RC2 installation preserved old-profile IndexedDB blobs/settings and reading progress; background contained no WebView2. User confirmed both deliberately shortened Adhan playback samples.
- Latest shared packaged checks passed 99/99; native timer/styles passed 22/22; focus/background/fullscreen timer checks passed 5/5. Rust scheduler/timer checks passed 17/17. The competing-reminder test inserts synthetic deadlines only after the normal close checkpoint, which otherwise correctly replaces the timetable.
- October 30 full native regression passed 32/32 after replacing the premature fixed auto-hide assertion with a normal foreground fixture and actual-hide polling. This includes actual Explorer restart and both physical monitors. The initial 31/32 failure is documented in the RC report.
- Final RC4 built and checksum recorded in `docs/WINDOWS-0.2.4-RC.md`. Actual upgrade/uninstall/reinstall preserved RC data; old IndexedDB blobs/settings loaded afterwards. Seven actual installed checks passed. The final installed background sample averaged 84.5 MiB total working set, 19.2 MiB private working set and 0.028% CPU with no WebView2 (earlier short sample about 71 MiB).
- Final Arabic panel screenshot review caught heading overhang; the compact heading now uses bundled Tajawal with safe padding. Real installed RC4 screenshots verify the correction. Full report and candidate icon review assets are ready.
- Final audit: actual S3 suspend/resume and lock/unlock performed on Windows 11 IoT Enterprise LTSC build 26100. User confirmed timer chime/popup after resume and widget recovery after unlock. Actual Narrator read prayer name/time/countdown clearly (human confirmation); Narrator restored off.
- Physical 150% testing exposed RC4's stale clipping region (300×60 clip on a 360×72 window). Local unreleased RC5 updates the region independently of OS resizing. Actual 150%, 200% and restored 125% readings now match full client bounds; countdown was visually complete. Original 125% setting restored.
- Windows 10 audit identified horizontal→vertical taskbar fallback waiting indefinitely in WebView mode. Targeted orientation recognition fixes it, retaining Windows 11 behavior. Two Windows 10 geometry/fallback tests added; 19 Rust tests and native feature compilation pass. Real Windows 10 22H2 testing remains pending.
- Distribution remains blocked: reserved-rights Adhan permission is unverified, other bundled content/notices need a complete provenance review, no trusted code-signing certificate is available, and automatic Sahib updates are not configured. Keep audit builds unsigned/local; do not publish production installers.
- Real Sion Maghrib at 17:19 fired at its scheduled deadline; user confirmed hearing Adhan and timer. Original app restored at 19:33 after the missed-alert grace period; separate RC test profile restored. No production settings changed.
- Remaining v1 scope authorized: desktop session/reader first, catalog migration in a separate commit, timer sound choices/independent volume/custom import, four layouts independent of theme, opt-in regional recommendation, localized permanent greeting and peach default. Preserve mobile layout, user choices, scheduler and PDF engine; freeze features after verification.
- Monitor hotplug, virtual-desktop switching and actual system-date rollover remain pending. Do not merge into main or release production builds.

- Desktop session now uses a reading/counter workspace at >=1024px; mobile wrappers use display:contents. Desktop keyboard counting/navigation reuses existing session handlers. Reader auto-hide preserves viewport geometry; fits use current PDFium page dimensions. Isolated two-page PDF test passed fit-page/actual-size, bookmark and page restoration, inactivity hide and focus wake.

- Catalog is generated from catalog/books.json, overrides and opt-in *.catalog.json manifests. All 70 legacy IDs/path strings and 10 beginner entries preserved; no DB/cache identifiers changed. No verified PDF redistribution evidence is currently recorded, so new downloads are gated; legacy cached PDFs still read successfully. Removed automatic PDF downloads at SW installation. Desktop cards/folder explorer share existing local imports and reader; view selection persists. Catalog checks, encoded URL checks, folder switch and cached two-page PDF read passed. Optional remote OPDS fetching is not introduced.

- Four independent compact layouts: Signature (landmark, unchanged default), Classic (minimal), Slim, Countdown Focus; legacy ribbon remains selectable. Actual native screenshots reviewed in Catppuccin/peach and Arabic. Confirmed CSS color-mix values could fall back to green in native painting; desktop adapter now resolves semantic colors to RGB before native transfer.
- Timer offers generated Gentle Chime/Soft Bell/Wooden Tap/Digital Beep, Silent and local Custom WAV/MP3/OGG with independent volume. Actual QA persisted all choices, decoded a custom WAV and rejected invalid volume. Default prayer recordings changed only for fresh preferences to Al-Qatami standard/Fajr; saved choices unchanged.

- Final native repeatable suite passed: all six themes resolve native colors, four built-in/silent sound selections persist, custom WAV and MP3 decode, invalid inputs rejected, four layouts persist, timer completes after main WebView destruction, Adhan preferences remain unchanged. OGG hardware/codec listening still needs manual verification.
- Desktop library now routes local previews through the existing local-cover renderer and shares the existing progress markup. Metadata-only entries no longer initialize PDFium just to seek a forbidden cover download. Actual imported PDF preview/progress and no-overflow check passed at 1280×720.
