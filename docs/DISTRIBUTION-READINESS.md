# Distribution readiness — 2026-10-31

Status: **public Windows distribution remains blocked**. The standard build is now prepared as Sahib 0.2.4, promoting completed RC functionality and approved branding without an RC identity/profile. Historical RC7 and its evidence remain preserved. `main` is intentionally kept for the website; Windows releases must target `codex/windows-tauri`, not require a main merge. See [production preparation](WINDOWS-0.2.4-PRODUCTION.md) and [widget timing measurements](WINDOWS-PANEL-PERFORMANCE.md).

## Blocking rights review

- `assets/adhan/nasser-al-qatami.mp3` and `nasser-al-qatami-fajr.mp3`: no redistribution permission has been established. The Fajr recording reserves rights to Sharjah Quran. Awqat Salaat's software MIT license does not grant recording rights. See the pinned provenance and hashes in `assets/adhan/LICENSES.md`.
- `assets/asma-audio/`: recording provenance and redistribution clearance still need evidence.
- `js/vendor/embedpdf/`: complete version-pinned wrapper, PDFium, bundled font and third-party notices must accompany the actual vendored 2.15.1 artifacts. Current upstream licensing cannot simply be substituted for that version. Fuse 7 and Lucide also need complete applicable notices.
- Illustrated background provenance needs a completed attribution/ownership record before declaring the whole runtime cleared.
- The canonical catalog has 70 metadata entries and no verified PDF redistribution grants. Its download gate remains closed; previously cached files and private local imports remain accessible. No new PDF files are authorized for public bundling.

The first two items cannot be fixed by adding an attribution paragraph. Obtain permission or prepare and test a distribution that excludes the affected audio, provides cleared defaults and handles saved selections without breaking playback. The current private artifacts still include these recordings; no cleared substitute distribution has been verified. Removing audio alone would not close the outstanding version-pinned PDF-engine notices review. Do not remove the PDF engine without a functioning, licensed replacement or the correct notices.

No new recordings or PDFs are added by the closeout commits. Existing historical repository content is not rewritten or represented as cleared. New installer artifact uploads in the Windows CI workflow are disabled pending this review. Local builds are private recovery artifacts, not redistributable release assets. Do not create a GitHub Release/source archive purporting to be cleared while its tree still contains these assets.

## Build and acceptance status

- RC6 source/resource checks and catalog stability checks pass; the completed optimization passes 21 Rust unit tests and isolated actual Tauri lifecycle/widget checks. See the performance report and Windows freeze/compatibility documents for precise coverage and remaining manual cases.
- Actual Windows 10 22H2 acceptance is still outstanding. Windows 11 tests do not certify Windows 10. No Windows certification is claimed.
- Local installers are **unsigned**. No signing certificate has been configured; code signing remains a release decision after rights clearance. Never describe these builds as signed or Windows-certified.
- There is **no automatic Sahib update mechanism**. Future releases require a manually downloaded installer. WebView2 runtime updates do not update Sahib.
- Keep production identifiers, browser storage, IndexedDB, installed profiles and service-worker behavior unchanged. Main and the live PWA remain unchanged; cleared Windows releases target the Windows branch separately.

## Resume release preparation

1. Resolve the rights/notices above or prepare a cleared package and test its compatibility.
2. Run the recorded checks and actual Windows acceptance still outstanding; compare against main.
3. Verify the ordinary production configuration continues using approved `branding/sahib-0.2.4` artwork, native default features and the permanent identifier.
4. Choose the stable version/tag under the existing 0.2.x scheme; do not label the RC as stable.
5. Leave main/the live website unchanged. Once cleared, publish tag `v0.2.4` from the verified `codex/windows-tauri` commit, title `Sahib 0.2.4 — Windows`, and upload only the verified normal installer and SHA-256 to GitHub Release Assets. Never commit build outputs.

See [FUTURE-MOBILE-WEB.md](FUTURE-MOBILE-WEB.md) for documentation-only future plans.
