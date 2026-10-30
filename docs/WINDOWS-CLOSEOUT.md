# Windows development closeout — 2026-10-31

Feature development is frozen. No Android development, website redesign or new features were started during closeout.

## Source and publication

- Widget opening optimization: commit `711add9`; verified source/readiness push: `94d8b8a695607da44a7dfa304391f41dae339cad` on `codex/windows-tauri`. Later closeout documentation commits do not change the runtime.
- Remote: `https://github.com/Nobodyssssy/sahib.git`. Remote main remains `49fb5b95219c002d43b0ccdc3ac5da1d206e057a`. No merge, stable tag or GitHub Release was created because distribution gates did not pass.
- Exact blockers and next release steps: [DISTRIBUTION-READINESS.md](DISTRIBUTION-READINESS.md). Reserved-rights audio cannot be cleared by including a notice. No new recordings, PDFs, profiles, installers or build output were pushed.
- Installer/compiled-runtime uploads were removed from Windows CI pending clearance. Build and acceptance checks remain; this does not retroactively remove existing historical assets or artifacts.

## Verification

- Final source checks: 57 scripts, 82 HTML resource links, 116 precache entries; catalog checks preserve 70 legacy IDs/paths and 10 reading-order entries. All passed.
- Native unit suite: 21 tests passed, including scheduler, deduplication, missed sounds, focus, timers, geometry, decoder and panel instrumentation guards.
- Prior actual isolated optimized Tauri suites passed rich-panel lifecycle and existing widget/layout/timer regressions. [Performance report](WINDOWS-PANEL-PERFORMANCE.md): warm median 494 → 35 ms; first cold sample 564 → 442 ms. Temporary suspended cache adds about 67 MiB private resident memory; idle eviction returns to native-only. No claim of instant cold creation.
- Live existing deployment checked at `https://nobodyssssy.github.io/sahib/`: active/controlling worker at `/sahib/sw.js`, scope `/sahib/`, current cache `sahib-v2.13.8`; manifest and installability checks reported no errors. Direct morning-Adhkar entry and refresh passed. Offline home reload and both localStorage/IndexedDB test values survived in a disposable profile.
- Actual automated PWA installation could not run: Edge advertises the experimental protocol domain but returns `PWA.install wasn't found`, at both target and browser scope. Manual browser-menu installation remains unverified in this pass. No user browser profile was altered. PDF/audio redistribution was not exercised by downloading external books/recordings.
- The new Windows branch has **not** been deployed to Pages. Existing live PWA verification must not be presented as verification of a newly merged release.
- Windows 10 execution, remaining DPI/monitor cases and other manual acceptance limits remain documented in [WINDOWS-COMPATIBILITY.md](WINDOWS-COMPATIBILITY.md) and [WINDOWS-V1-FREEZE.md](WINDOWS-V1-FREEZE.md).

## Private recovery installer

Candidate **0.2.4-rc.7**, approved RC branding, built successfully by Tauri/NSIS x64; **unsigned**, not installed over the user's app and not publicly released. Size: 23,100,556 bytes. SHA-256:

`87c2193d810b68b577be54c04ee81add11501691a513ffd75d4ec07d6eea23b6`

Kept in ignored `releases-local/0.2.4-rc.7/` and the private backup. The executable's limited static import audit found no known Windows-11-only imports; this is not Windows 10 execution or certification. Sahib has no automatic updater. No final stable production version/tag is claimed.

## Recovery and disk cleanup

Permanent private backup: `E:\Backups\Sahib\2026-10-31-closeout-004229`.

Includes complete `.git`, all-ref Git bundle, a mirror actually restored from the bundle, private maintenance snapshot with ignored local inputs, candidate/older installer artifacts, licensing records, QA evidence/profiles and separately copied existing application profiles. `RESTORE.md` contains restoration/build steps and privacy warnings. Browser-wide Edge/Chrome profiles are deliberately excluded; export Sahib browser data through the app if needed. The stable `com.sahib.companion` profile was not present at the inspected paths; no nonexistent profile backup is claimed.

Git bundle verification, restored branch hash comparison and restored `git fsck --full` passed. **38,341 files / 9,141,101,925 bytes** passed full SHA-256 read-back verification before any cleanup. `SHA256SUMS.json` and `CHECKSUM-VERIFIED.json` record that verification. The final source/documentation refresh has its own verification record and updated bundle/manifest.

Cleanup removed the following literal workspace targets after verified backup. `.vs/` was absent. Vendored runtime PDFium/EmbedPDF, font files, original assets, `.git`, personal audio, local source/design notes, metadata and all global toolchains remain. No installed application or installed profile was removed.

| Removed target | Bytes |
|---|---:|
| `src-tauri/target/` | 38,020,634,417 |
| `.qa/` (evidence/profiles preserved privately) | 5,712,412,618 |
| `node_modules/` | 16,515,960 |
| `dist/` | 32,430,416 |
| `.opencode/node_modules/` (local dependency cache; lockfile preserved) | 55,423,592 |

Initial measured workspace: approximately **44.58 GB**; immediately before cleanup, **44.84 GB** after the final candidate build. After cleanup: **1.00 GB**. Net recovery relative to the initial measurement: **43.58 GB**. Actual removed outputs totaled **43.84 GB**, including outputs created during verification. These are decimal GB, logical file sizes, not NTFS allocated-cluster accounting. The remaining size includes the complete original `.git` (about 0.94 GB) and private final installer. Small subsequent documentation/Git writes do not materially change the rounded totals. Exact cleanup measurements are preserved in `releases-local/CLEANUP.json` and the backup.

Future work is documentation only: [FUTURE-MOBILE-WEB.md](FUTURE-MOBILE-WEB.md). Release preparation can resume when permissions/notices are resolved; feature development remains closed.
