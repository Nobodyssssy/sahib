# Sahib 0.2.4 — normal Windows packaging

The user authorized promotion on `codex/windows-tauri`. Keep `main` and the live website unchanged. This is packaging of completed functionality, not new feature development.

## Normal build

- `productName`: `Sahib`; version `0.2.4`; permanent identifier `com.sahib.companion`.
- Expected installer: `Sahib_0.2.4_x64-setup.exe` with a same-name `.sha256` sidecar.
- `npm ci`, then `npm run desktop:build`. No RC config, special feature flags or environment branding flag are required.
- Default features enable the native compact widget, authoritative native reminders/audio/timer, on-demand main window and bounded rich-panel warm cache. The compatibility renderer remains available.
- Existing internal feature names `native-widget-rc` and `brand-preview` remain for compatibility, but are enabled by default. They are not production-facing labels and do not change application identity.
- Normal Windows executable, installer, shortcut and tray use `branding/sahib-0.2.4` approved artwork. Packaged web icons use those exports; source website icon files and theme/accent-adaptive in-app logo remain unchanged.
- Production titles and About show Sahib / 0.2.4. Historical RC configuration, documents, screenshots and packages are retained as records; the normal build does not create/use `com.sahib.companion.rc`.
- Storage/IndexedDB identifiers and schedule calculations are unchanged. Existing RC profile data are not automatically copied over the permanent production profile; no profile replacement/migration is performed.

## Fajr reference

[User-supplied reference](https://www.youtube.com/watch?v=gNk5LmR9qJM) is listed in Settings → About → Sources & licences and `assets/adhan/LICENSES.md`. Performer, publisher and relationship to the bundled recording could not be independently verified. No new recording identity is asserted. Credit is not redistribution permission; no audio was downloaded from YouTube. Local user imports remain supported and private.

## Verification

After preparing/building runtime assets, run `npm run desktop:verify-production`. It checks permanent identity/version, default features, approved icon hashes, notice resources, production labels and EN/AR source credit. `node tools/verify-production-windows.mjs --release --native` additionally builds an isolated QA application with **no explicit native/brand feature flags**, then verifies the actual default native renderer, window title, version and About text. The isolated test does not use an installed profile and is not an RC installation.

Use existing panel lifecycle and widget suites for scheduler/timer/layout/compatibility regressions. Actual installer hash/signature and results are recorded after the build. The installer is unsigned unless an actual valid Authenticode signature is verified; no Windows certification is claimed. Sahib has no automatic updater.

Verification during promotion: 21 native unit tests passed; actual default-feature Tauri checks confirmed native windows/version/title/About, and the panel lifecycle plus widget-v1 regressions passed. The full application/compatibility suite passed 99 checks after updating its local PDF fixture and explicitly selecting its existing keep mode. The normal native default is tested separately without an override. The idle test waits for finished cold navigation and actual suspension before its shortened QA lease. No catalog or prayer logic was changed to make tests pass.

## Publication gate

**Not cleared for public distribution yet.** See [DISTRIBUTION-READINESS.md](DISTRIBUTION-READINESS.md) for outstanding reserved-rights audio, Names recording and version-pinned dependency/content notices. The new YouTube credit supplies no permission and does not close those gates. Automatic CI binary uploads remain disabled.

Once clearance and release checks pass:

1. Confirm the exact source commit on `codex/windows-tauri` and that `v0.2.4` does not already identify a different release. Do not change the version without a real conflict.
2. Create `v0.2.4` from that Windows branch commit, not main.
3. Title: **Sahib 0.2.4 — Windows**.
4. Upload only `Sahib_0.2.4_x64-setup.exe` and its verified `.sha256` under GitHub Release Assets; disclose unsigned status and manual updates.
5. Verify the downloaded assets/checksum before declaring the release complete. Do not commit installer/build/profile files or merge into main.
