# Knowledge and media publishing

## Phase 1 — static catalog (implemented)

- Bilingual resource hub, regulations catalog and guide collection.
- Existing publication URLs and PDF storage remain valid.
- Regulations are a reviewed build-time JSON catalog, not a live external API.
- Review date, official source, status and amendments are recorded per entry.
- Search/filter works locally; all records remain readable without JavaScript.
- Cover images load lazily. No embedded PDF viewers or Google Drive requests.
- Sources were checked on 2026-10-05. English titles are editorial translations.
- Legal source links live in `src/data/regulations.json`. Recheck the official text and status before changing entries. PP 8/2026 specifically concerns Batam; do not describe it as a universal change to local forestry procedures.

## Phase 2 — approved media publishing (pending configuration)

Keep Drive as the original/draft repository. Select an explicit approved folder;
never expose drafts or mirror an entire Drive automatically. Produce optimized
image variants locally/build-time with dimensions, WebP/AVIF where appropriate,
and a fallback image. Publish immutable copies before updating the catalog.
Existing GitHub Release media remains the fallback. No migration is needed for
Phase 1. Confirm dedicated website R2 bucket/domain/access before enabling R2;
keep WebGIS storage separate.

## Phase 3 — controlled synchronization (pending configuration)

Run synchronization in publishing workflows, never in visitors' browsers.
Require explicit approved status, validate MIME/size/checksum/links, and refuse
partial publication. Preserve the last good deployment on Drive/R2 failure.
Keep credentials only in repository/environment secrets. Do not overwrite
current files in place; publish versioned assets and retain rollback copies.

## Performance acceptance for later phases

Measure identical representative pages before and after on mobile and desktop.
Target LCP <= 2.5s, CLS <= 0.1, INP <= 200ms in field measurements when available;
lab measurements are diagnostic, not a substitute for field data.
Prioritize the hero image; lazy-load off-screen images; supply responsive sizes.
No runtime Drive API, PDF preload, full GIS embed, or heavy client framework.
Compare transferred bytes and request count with baseline before rollout.

## Concurrent work

Develop on a feature branch. Reconcile current main before merging. Main deploys
automatically to GitHub Pages. Never reset or overwrite other local worktrees.

## Phase 2a — regulation reader and archived originals

Regulations now have bilingual detail/reader pages, local PDF download links,
and independent links to official catalog pages and original government files.
The PDF iframe is created only after a reader clicks Show PDF. The catalog and
reader metadata cause no PDF transfer on initial load. Mobile browsers can use
the direct same-domain PDF link if embedded viewing is unsupported.

Original PDFs are stored in a separate GitHub Release, not in Git history or
Google Drive runtime calls. `prepare-regulation-documents.mjs` derives the
release tag from the reviewed document checksums. The archive job can publish
only after every included document matches the reviewed SHA-256, length, and
PDF signature. Subsequent deployments download that release and verify it.
The build job remains read-only. A failed source/archive verification stops a
new deployment and leaves the last successful website online.

For a new or changed document: download from its government source, verify its
identity/completeness (including annexes), update metadata/checksum/page count,
and review the generated release. Never overwrite an older release asset.
Cloudflare R2 and Drive synchronization remain pending; this phase uses the
existing GitHub Pages delivery infrastructure.
