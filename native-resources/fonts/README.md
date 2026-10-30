# Native Arabic typography

`Tajawal-Medium.ttf` is the existing Sahib `assets/fonts/Tajawal-Medium.woff2` decompressed for Windows DirectWrite: 26,144 bytes. It is registered privately in Sahib's font collection, not installed into Windows. `OFL-Tajawal.txt` preserves the bundled license and attribution.

DirectWrite handles Arabic shaping, bidirectional text and diacritics. Numeric times remain left-to-right. Segoe UI supplies Latin/numeric labels. Existing Amiri remains suitable for longer Arabic text in the rich application; no second large native Arabic family is added.

`python tools/prepare-native-fonts.py` recreates the native font and audits existing faces. Optional Noto comparison sources in `.qa/font-candidates` are development-only and excluded from packages. See `docs/windows-0.2.4/font-comparison.json` and `font-audit.json`. FontTools with WOFF2 support is a development-only requirement.
