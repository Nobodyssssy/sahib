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
- Real Sion Maghrib at 17:19 was observed in the alert ledger 308 ms after the deadline (the stored value is scheduled time, not actual playback latency); user confirmed hearing Adhan and timer. Original app restored at 19:33 after the missed-alert grace period; separate RC test profile restored. No production settings changed.
- Remaining v1 scope authorized: desktop session/reader first, catalog migration in a separate commit, timer sound choices/independent volume/custom import, four layouts independent of theme, opt-in regional recommendation, localized permanent greeting and peach default. Preserve mobile layout, user choices, scheduler and PDF engine; freeze features after verification.
- Monitor hotplug, virtual-desktop switching and actual system-date rollover remain pending. Do not merge into main or release production builds.

- Desktop session now uses a reading/counter workspace at >=1024px; mobile wrappers use display:contents. Desktop keyboard counting/navigation reuses existing session handlers. Reader auto-hide preserves viewport geometry; fits use current PDFium page dimensions. Isolated two-page PDF test passed fit-page/actual-size, bookmark and page restoration, inactivity hide and focus wake.

- Catalog is generated from catalog/books.json, overrides and opt-in *.catalog.json manifests. All 70 legacy IDs/path strings and 10 beginner entries preserved; no DB/cache identifiers changed. No verified PDF redistribution evidence is currently recorded, so new downloads are gated; legacy cached PDFs still read successfully. Removed automatic PDF downloads at SW installation. Desktop cards/folder explorer share existing local imports and reader; view selection persists. Catalog checks, encoded URL checks, folder switch and cached two-page PDF read passed. Optional remote OPDS fetching is not introduced.

- Four independent compact layouts: Signature (landmark, unchanged default), Classic (minimal), Slim, Countdown Focus; legacy ribbon remains selectable. Actual native screenshots reviewed in Catppuccin/peach and Arabic. Confirmed CSS color-mix values could fall back to green in native painting; desktop adapter now resolves semantic colors to RGB before native transfer.
- Timer offers generated Gentle Chime/Soft Bell/Wooden Tap/Digital Beep, Silent and local Custom WAV/MP3/OGG with independent volume. Actual QA persisted all choices, decoded a custom WAV and rejected invalid volume. Default prayer recordings changed only for fresh preferences to Al-Qatami standard/Fajr; saved choices unchanged.

- Final native repeatable suite passed: all six themes resolve native colors, four built-in/silent sound selections persist, custom WAV and MP3 decode, invalid inputs rejected, four layouts persist, timer completes after main WebView destruction, Adhan preferences remain unchanged. OGG hardware/codec listening still needs manual verification.
- Desktop library now routes local previews through the existing local-cover renderer and shares the existing progress markup. Metadata-only entries no longer initialize PDFium just to seek a forbidden cover download. Actual imported PDF preview/progress and no-overflow check passed at 1280×720.

- Confirmed hidden Classic→Signature transition retained the old clip shape; track the last actually applied region rather than hidden-window observations. Actual region probe now verifies the rounded corner after hidden selection; all native regression checks still pass.
- Final v1 feature scope is frozen on this branch, with only acceptance/defect/accessibility/licensing/release work remaining. See docs/WINDOWS-V1-FREEZE.md. No main merge or production release.

- Final self-contained UI acceptance passed 1280×720, 2560×1440 at browser DPR 2, and 390×844 mobile; separate 1920×1080 reader and dark greeting/theme-font checks passed. Browser scale is not physical Windows DPI verification. Custom sound reselection from the actual expanded widget now persists after main destruction; native suite re-passed.

- Final visual/accessibility review corrected smaller greeting contrast by inheriting the readable hero color and localized the session TAP/Prev/completion text. Arabic label and active theme-font checks passed.

- Final unsigned local RC6 built successfully: 23,073,294 bytes; SHA-256 ac77687d1fa97133f0c7d195d92dc3aa14cc80a20e8b82dd671389544a3618a4. Release integrity and limited PE import audit pass. Original installed Sahib remains running; QA processes closed. Changes committed locally on codex/windows-tauri; no main merge or production publication.


## Expanded-panel performance work (user-authorized post-freeze refinement)

- Baseline measured in an isolated optimized QA build, with the main WebView destroyed: five opens all rebuilt the rich window. First content-ready 564 ms; subsequent rebuilds 493–516 ms. Window/WebView construction 342–382 ms; state fetch only 2–4 ms.
- Candidate uses native state bootstrap, one generated CSS bundle, coalesced construction, and show/hide reuse. Hidden panel script intervals stop; supported WebView2 TrySuspend/Resume reduces idle work. Reuses existing WebView2 binding as an explicit optional dependency, with no new package versions or runtime.
- Retain the rich panel for 60 seconds after use, then release it via the existing native watchdog; native-only startup creates no WebView. Opportunistic preload only while the main app is visible. Collapsed cached renderers suspend; native prayer/audio/timer scheduling stays authoritative.
- Optimized measurements: first cold open 442 ms; four warm opens 22–56 ms (median 35 ms). A separate first open using startup preload was 59 ms. These are native-handler-to-two-animation-frame markers, not hardware click-to-photon measurements.
- Whole-tree memory: old collapsed 86 MiB summed WS / 17 MiB private resident / 62 MiB private commit. Suspended warm cache: 361 / 84 / 259 MiB; after test idle eviction 85 / 15 / 60 MiB, only native host remains. Shared working sets can double-count DLL pages. Extra resident RAM is temporary, not zero; CPU samples remain below 0.1% of the 16-logical-processor host while suspended.
- Lifecycle checks passed: hidden startup preload, main responsiveness, same-document warm reuse, live location/timer hydration, suspension, idle eviction and cold recreation. Compatibility renderer/floating transitions are being checked in the final candidate. 21 Rust tests pass, including stale/repeated timing-record guards. No main merge or production replacement.

- Final suspended-cache lifecycle suite passed with the main closed for widget-only data checks: current timer display within one tick of native time, same document reused, and compatibility compact/floating transitions remain live. Startup preload and idle eviction/recreation also pass. Timing records are available in desktop_state.panelTiming and benchmark/report tools; no per-second log writes.
- Policy: native-only startup stays native-only; main-visible opportunistic preload; hidden JS intervals paused; best-effort supported WebView2 suspension; 60-second idle lease serviced by existing watchdog. Report records both the temporary +67 MiB private-resident / +197 MiB commit cost and return to native-only after eviction. Source/API review confirms no Windows-11-only API; actual Windows 10 still pending.

## Closeout — 2026-10-31

- User authorized branch publication, production merge/release only after release checks, permanent recovery backup and regenerable workspace cleanup. No further feature work or Android implementation.
- Final repeat: resource checks (57 scripts, 82 HTML resources, 116 precache entries), catalog checks (70 stable entries/10 reading-order entries), and 21 native unit tests pass. Performance refinement committed as 711add9; previous actual isolated lifecycle/widget evidence retained for backup.
- Distribution remains blocked by reserved-rights Al-Qatami recordings, unverified Names audio and incomplete version-pinned vendor/content notices. Do not merge or upload a binary/source release claiming clearance. Windows CI no longer uploads installers or saves compiled runtime caches while clearance is pending; source changes do not add recordings/PDFs.
- Approved brand assets are preserved. The private RC7 recovery package uses approved RC branding, not a claimed final production installer. Keep the installed app/profile untouched. Documented unsigned status and lack of automatic updates.
- Future architecture documented only in docs/FUTURE-MOBILE-WEB.md. Recovery backup and measured cleanup are the remaining closeout operations.

- Private RC7 built successfully: 23,100,556 bytes; SHA-256 87c2193d810b68b577be54c04ee81add11501691a513ffd75d4ec07d6eea23b6. Unsigned; preserved in ignored releases-local and the private backup, not publicly released or installed over the user's app.
- Permanent recovery backup: E:\Backups\Sahib\2026-10-31-closeout-004229. Complete Git directory/all-ref bundle, actual restored mirror/fsck, maintenance snapshot, installers, QA evidence and separate existing application profiles. All 38,341 files (9.14 GB) passed SHA-256 read-back before cleanup. Browser-wide profiles were not copied; no stable com.sahib.companion profile existed at inspected paths. RESTORE.md documents recovery and privacy.
- Removed only src-tauri/target, .qa, dist, root node_modules and the backed-up project-local .opencode/node_modules cache. Lockfiles/source/config kept. Initial 44.58 GB → about 1.00 GB; net recovered 43.58 GB. Actual deleted outputs 43.84 GB including newly built verification outputs. No global toolchain, installed app/profile, runtime dependency, .git, personal audio or source deletion.
- Existing live PWA: active controlling worker/scope under /sahib/, manifest/installability checks, direct entry/refresh, offline home and localStorage/IndexedDB persistence passed. Automated installation remains unavailable (PWA.install method not found); manual browser installation outstanding. Windows branch has not been deployed: main merge and public release are blocked by distribution clearance, not claimed complete.
- Final closeout record: docs/WINDOWS-CLOSEOUT.md. Feature development is closed. Final documentation push and recovery-bundle refresh preserve the closeout commit; release can resume only after the documented gates pass.

## Standard Windows promotion — user-authorized 2026-10-31

- User explicitly requested normal Sahib 0.2.4 packaging on codex/windows-tauri, keeping main/Pages unchanged and publishing a branch-targeted GitHub Release only once cleared. Permanent identifier remains com.sahib.companion; no RC app/profile is created by the normal build.
- Default Cargo features now enable the same completed native compact/widget lifecycle and approved tray artwork previously selected by the RC build. Legacy internal feature names are retained for compatibility; no special feature/config flags are required by desktop:build.
- Normal Tauri config now points at approved executable/installer/shortcut icons and bundled font notices. Packaged web icons use approved artwork; source website icons and theme-adaptive sidebar are preserved. Production window titles/About no longer say RC, Preview or Brand Review. Historical RC config/docs/evidence remain.
- Added EN/AR About reference and assets/adhan/LICENSES.md entry for https://www.youtube.com/watch?v=gNk5LmR9qJM. Page retrieval/exact-ID search did not verify recording identity. No performer/publisher/match assertion or redistribution grant; no YouTube media downloaded. Local import support unchanged.
- Locked Node build dependencies restored for the requested installer; only release-mode Rust output is rebuilt to limit disk use. Static production identity/defaults/icon-hash/licence/About checks pass; native and installer verification are in progress. Public audio/vendor clearance is still unresolved, so no public release/tag is authorized by a reference credit alone.

- Actual default-feature Tauri check passed with no explicit native/brand flags: native windows exist, title/version/About are normal Sahib 0.2.4. Native layout/theme/timer/custom-import regression passed. Lifecycle passed after its idle phase was made to wait for completed cold navigation and actual suspension; an independent probe confirmed expiry after nine seconds with the QA five-second lease.
- Broad compatibility acceptance exposed a stale test: replace the blocked public catalog download with an authored local PDF. Seven application suites pass their checks. The compact assertion then exposed that the pre-existing diagnostic `keep` mode relied on the old non-native default; now recognize explicit keep so existing comparison/compatibility tests remain valid while normal startup stays native. Rechecking that mode before final installer creation.

- Rebuilt native-default QA passed after explicit keep support. The full application/compatibility acceptance run passed 99 checks; native panel lifecycle and widget-v1 layout/theme/timer/custom-import checks passed. All nine approved ICO resolutions were found embedded in the executable. No application PDF engine, catalog gate, prayer calculation, schedule, counts or storage formats were changed. Production code is ready for the ordinary NSIS build; public distribution remains blocked independently of build success.

- First normal NSIS build exposed a packaging gap: bundle.icon updates the application but does not set NSIS's own installer/uninstaller artwork. Generated installer.nsi had empty INSTALLERICON/UNINSTALLERICON. Set both supported NSIS fields explicitly to the approved ICO and added production guards for them; regenerate via Tauri's supported bundle command against the already built normal executable.
