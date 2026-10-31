# Book catalog maintenance

Run `node tools/build-book-catalog.mjs` after editing `catalog/books.json`, `catalog/overrides.json` or adding an explicit `catalog/*.catalog.json` manifest. `js/books-data.js` is generated. Desktop preparation runs the generator; verification rejects stale output. `node tools/test-book-catalog.mjs` guards existing IDs and URL mappings.

Manifests supply available title, author, language, category, description, source and optional `readingOrder`. Unknown metadata stays empty. Curated overrides are keyed by stable book ID. Existing IDs must not be regenerated from titles. New files in `assets/books` are discovered at build time; filesystem PDFs require recorded redistribution evidence before a successful build. A filename supplies a fallback label, not invented author metadata. No personal import directories are scanned.

Set `rights.redistribution` to `verified` only after checking permission for that specific edition, with a meaningful `rights.evidence` reference. New unverified catalog entries are metadata only for new users; the explicit existing-Cloudflare exception below restores legacy access. Previously cached copies retain access at their original URL; the `sahib-books` bucket and all IndexedDB keys stay unchanged. An optional verified `officialUrl` can retain an authority's source link. Do not use an unrelated third-party PDF host as evidence of permission.

Personal PDFs remain local IndexedDB imports in the same library and reader. Optional build manifests are explicitly supplied inputs; the build never downloads remote catalogs. No OPDS network client is added in this change. External sources require a reviewed metadata manifest; they do not automatically authorize PDF redistribution.

## Existing Cloudflare access

`catalog/download-policy.json` explicitly restores the 67 existing catalog downloads requested by the user. Atomic Habits, Deep Work and Thinking, Fast and Slow remain import-only for uncached copies. This scoped access list does not mark redistribution rights as verified, approve newly added books, or authorize bundling PDFs. Previously cached copies and private attachments remain readable under the same IDs. The generator still requires edition-specific evidence for bundled PDFs.
