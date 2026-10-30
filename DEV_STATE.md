# Development state

Branch: `codex/windows-tauri`. Do not merge into `main` yet.

## Decisions

- Keep Tauri for the full application and rich panel; use the native compact widget only in the separate 0.2.4 RC. Retain the selectable WebView fallback.
- DirectWrite renders bundled Tajawal Arabic; Segoe UI handles Latin/numeric labels. No additional Noto family is packaged.
- Candidate forest/peach icons derive from the existing inline Amiri صاحب logo. Production branding awaits user approval.
- Daily Adhkar counts reset at the local calendar date boundary. Synchronize live counters as well as IndexedDB; recheck on focus, visibility, active use and every 30 seconds while visible.
- Morning/evening home practice shortcuts open the corresponding Adhkar collection directly.
- Add three compact designs, an optional hh:mm display, and a persisted native session timer. Focus mode suppresses other Sahib reminders but allows prayer-time Adhan. It does not control Windows or other apps.

## Verification and open work

- Earlier 0.2.4 checks: release native regression 32/32; lifecycle 66/66; typography 17/17. Actual RC1→RC2 installation preserved old-profile IndexedDB blobs/settings and reading progress; background contained no WebView2. User confirmed both deliberately shortened Adhan playback samples.
- Latest shared packaged checks passed 99/99; native timer/styles passed 22/22; focus/background/fullscreen timer checks passed 5/5. Rust scheduler/timer checks passed 17/17. The competing-reminder test inserts synthetic deadlines only after the normal close checkpoint, which otherwise correctly replaces the timetable.
- October 30 full native regression passed 32/32 after replacing the premature fixed auto-hide assertion with a normal foreground fixture and actual-hide polling. This includes actual Explorer restart and both physical monitors. The initial 31/32 failure is documented in the RC report.
- Final RC4 built and checksum recorded in `docs/WINDOWS-0.2.4-RC.md`. Actual upgrade/uninstall/reinstall preserved RC data; old IndexedDB blobs/settings loaded afterwards. Seven actual installed checks passed. The final installed background sample averaged 84.5 MiB total working set, 19.2 MiB private working set and 0.028% CPU with no WebView2 (earlier short sample about 71 MiB).
- Final Arabic panel screenshot review caught heading overhang; the compact heading now uses bundled Tajawal with safe padding. Real installed RC4 screenshots verify the correction. Full report and candidate icon review assets are ready.
- Physical 150%/200% displays, actual sleep/lock, monitor hotplug and Narrator listening remain unverified. Native offscreen text renders covered all four scales.
- Do not replace production branding or merge into main until the user reviews the result.
