# Ruang Staf Yayasan Gambut

Implementation for a separate Cloudflare Worker at `https://staff.yayasangambut.org`.
**Not activated until the external integrations below have been provisioned.**
The existing GitHub Pages website is unchanged by this package.

## What is implemented

- Google OpenID Connect authorization-code login with PKCE, nonce, one-use browser-bound state, Google signature/audience/issuer verification, verified email **and** Workspace `hd` claim.
- Workspace domain `yayasangambut.org`; automatic staff registration. Initial administrator `mulyadi@yayasangambut.org`; initial editor **`zamharier@yayasangambut.org`**. Exact spelling is deliberate. Existing users retain their assigned role; changes take effect server-side on every request.
- Eight-hour server-side sessions, secure HttpOnly host-only cookies, same-origin writes, private no-store API responses, no token in localStorage, no GA tracking inside the staff dashboard.
- Private D1 drafts, editing, preview, submit/return review workflow and concurrency protection. Staff see only their own drafts and media; editors see all. Only editor/admin can publish. Account disablement revokes sessions. Admin can assign staff/editor, but cannot create another administrator through the UI.
- Rich text with server-side HTML allowlist. Pasted text is plain text. Images are re-encoded by the browser, strip EXIF metadata, max 2000px and 2 MB; server validates signatures. SVG uploads rejected. R2 objects are private until an editor explicitly publishes an article referencing them. Previously published images remain public to avoid breaking articles.
- Publication writes only `src/content/articles/{id,en}/staff-{uuid}.md` on main, using a restricted GitHub App installation. A unique stable slug prevents collision with existing content. GitHub Pages workflow success is checked before the dashboard labels it published. Existing site archives remain in the public website; this first version manages new dashboard articles only. Editing a published article creates a draft revision while the existing website version remains live until republished.
- Analytics Data API: aggregate visitors, sessions, page views, engagement, daily trend, top pages, traffic channels for property **253733616**, 7/28/90 complete days through yesterday. Editor/admin only; read-only service account. A connection error is shown rather than fabricated counts.
- Bahasa Indonesia UI, separate Indonesian/English entries, responsive layout, audit events, media library, user management. No autosave, scheduling, archive import, or translation automation is claimed.

## Required external activation

1. Cloudflare account with the `yayasangambut.org` zone active. Create **dedicated** resources; do not touch WebGIS database or buckets:
   - Worker `yg-staff`
   - D1 database `yg-staff`
   - private R2 bucket `yg-staff-media` (no public bucket endpoint)
   - custom domain `staff.yayasangambut.org`
2. Google Cloud project owned by YG's Workspace organization:
   - OAuth audience **Internal**, branding “Ruang Staf Yayasan Gambut”.
   - Web OAuth client; redirect URI exactly `https://staff.yayasangambut.org/auth/callback`.
   - Only `openid email profile` login scopes. No Drive, Gmail, or Analytics permission is requested from staff.
3. Restricted GitHub App installed on **only** `mulyadibagan/yayasangambut-website`: Contents read/write, Actions read, Metadata read. No administration or organization permissions. Store private key and installation IDs as Worker secrets. This authorization requires explicit approval; do not automatically broaden access.
4. Enable Google Analytics Data API in the YG Cloud project. Create a dedicated service account and grant **Viewer** to **only property 253733616**. Store its service-account email and PKCS8 private key as Worker secrets. Do not grant Google Workspace domain-wide delegation. This grant also requires approval.
5. If Google or Cloudflare presents new legal terms, stop for account-owner approval.

Never send credentials in chat, commit them, put them in `PUBLIC_` variables, or display secret values in logs.

## Deploy (authorized administrator, from this directory)

```sh
npm ci
npx wrangler login
npx wrangler d1 create yg-staff
npx wrangler r2 bucket create yg-staff-media
```

Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the returned database UUID. Confirm `APP_ORIGIN` matches the intended domain. This checked-in placeholder deliberately prevents accidental deployment against a guessed database.

Store each secret through the secure Cloudflare settings or `wrangler secret put` prompt:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` (PKCS8 PEM)
- `GITHUB_INSTALLATION_ID`
- `GA_SERVICE_ACCOUNT_EMAIL`
- `GA_SERVICE_ACCOUNT_KEY` (PKCS8 PEM)

Then:

```sh
npx wrangler d1 migrations apply yg-staff --remote
npm test
npm run check
npm run deploy
```

The first Worker deployment may be made before setting the secrets; login remains disabled until configured. The `workers_dev` endpoint is disabled; use the custom domain. Worker deployment is intentionally separate from GitHub Pages deployment.

## Acceptance checks before announcing availability

- Sign in as a standard Workspace staff user, `zamharier@yayasangambut.org` and the administrator; verify roles from `/api/me`. Sign-in tests must use authorized users, not impersonation or development bypasses.
- Personal Gmail login and a wrong Workspace domain must fail even if the UI is bypassed.
- Create draft, upload photograph; photo and draft must return 401 to a signed-out client. Another ordinary staff account must receive 403.
- Create/edit/submit a real test draft; verify editor review/return and optimistic version conflict behaviour.
- Publish an approved test article with a photo; verify the exact GitHub commit, successful Pages deployment, rendered article and photo on the public site. A build failure must not show “Terbit”.
- Verify Analytics totals against GA4 for the same property, full-day interval and WIB timezone. API failures must not be presented as zero visitors.
- Use user management to disable a designated test account and verify session revocation.
- Check desktop/mobile keyboard navigation and photo picker. Only after these checks add a staff login link to the public site's footer.

## Local checks

`npm test` exercises identity/domain checks, authorization, workflow restrictions, stale writes, HTML sanitization, media privacy, session revocation, and fail-closed configuration using a local SQLite-backed D1 adapter. `npm run check` compiles the Worker without deploying. These do not prove live OAuth, GitHub, R2 or GA connections.

For local development, use a separate local Wrangler config and a separate Google test OAuth client if needed. Do not add an authentication bypass to production code. Do not copy production sessions or credentials into tests.

## Operational notes

- Source content remains in GitHub; private drafts and audit records remain in D1. Use Cloudflare D1 backup/export and R2 lifecycle policies appropriate to the organization. Do not purge records automatically without an agreed retention policy.
- The main site's `prepare-production-pages.mjs` currently validates only archive URLs; staff media uses an independent HTTPS origin.
- Homepage article lists use existing site content rules. `featured:false` avoids automatically pinning each new story.
- Public website privacy copy should mention Workspace staff accounts when the staff service becomes active; update the existing statement that the public site has no accounts with a link to a dedicated staff privacy notice.
