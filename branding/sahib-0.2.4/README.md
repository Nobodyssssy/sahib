# Sahib approved Windows branding

The authoritative artwork is `index.html` → `.sahib-mark` (160 × 110). The Arabic word **صاحب** uses the existing `assets/fonts/Amiri-Regular.woff2`, shaped with HarfBuzz and converted to outlines. The arch and ornament reuse the existing paths. No part of the supplied mockup was cropped.

- `sahib-mark.svg`: clean, theme-adaptive `currentColor` master.
- `app-icon.svg`: stable forest-green / warm peach launcher master.
- `icon.ico`: independently rendered 16, 20, 24, 32, 40, 48, 64, 128 and 256 px layers. `icon-*.png` are the corresponding exports.
- `tray-icon.svg`, `tray-*.png`: simplified **ص** monogram from the existing collapsed sidebar identity, retaining the arch. The full word is too small to read reliably at 16 px.
- Android SVG/PNG foreground, background, monochrome and VectorDrawable/adaptive XML: future Android sources; no Android application was built or tested.
- `pwa-192.png` / `pwa-512.png`: exports used by the packaged Windows app; the source website icon files remain unchanged.
- `brand-review.png`: generated asset contact sheet. Real installed icon-resource screenshots are in `docs/windows-0.2.4/installed-icons.png`.

The normal `com.sahib.companion` Windows build now uses these approved assets for executable, installer, shortcuts, tray and packaged web icons. Existing internal Cargo feature names are retained for build compatibility and enabled by default; they do not label the production UI as RC/Preview. Historical RC configuration and review evidence are retained, but the standard build does not select them or create an RC profile. Source website icons are unchanged. No old referenced assets were deleted. Windows executable and installer icons are stable; the in-app logo remains accent-adaptive.

Rebuild from the repository root with `python tools/prepare-brand-candidate.py`. Development-only dependencies: fonttools 4.67.0, uharfbuzz 0.56.4, resvg-py 0.5.0 and Pillow, plus a WOFF2 decoder. No font installation or runtime Python dependency is required. The font's SIL Open Font License is retained in `OFL-Amiri.txt`; provenance and source hash are in `provenance.json`.
