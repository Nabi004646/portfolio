# Verification — 30 October 2026

These results describe local code/build checks and a private browser preview. No production account or website was connected or deployed.

## Passed

| Check | Actual result |
|---|---|
| `npm run build` | Passed; 17 generated preview HTML files, including error documents; 15 successful routes validated |
| Current public article count | 0; starter article templates remain private drafts |
| Node test suite | 23 passed, 0 failed |
| Synthetic article build | 8 fixture articles; metadata, links and structured data checks passed across 35 successful HTML routes |
| Backend Deno tests | 13 passed, 0 failed; email, bot verification and deploy-hook network calls mocked |
| Deno type checks | Passed for submit-contact, submit-visit and request-publish |
| Cloudflare function compilation | Passed using Wrangler 4.156.0; no deployment made |
| Desktop browser | Full article, author/dates, source/project links, optimized featured image and TOC rendered; 1348px document width without horizontal overflow |
| Phone/tablet browser layout | Synthetic article embedded at 390px and 768px frame widths; document client/scroll widths matched at 375px and 753px after scrollbars |
| Mobile navigation | Opened with keyboard activation; six navigation links visible |
| Studio browser | Editable SEO/social fields, draft save, search estimate updates and private article preview worked |
| Saved slug stability | Changing a saved draft title retained `seo-workflow-check`; no automatic URL rename |
| Publishing browser | Status panel, disabled local retry and public JSON export control visible |

The responsive harness used the real rendered article/CSS at narrow frame viewports, not a physical phone or touch-device test. Its synthetic articles and QA-only framing headers are not in the shipped site build. Some browser pointer/screenshot actions timed out; keyboard activation and the documented capture API completed the relevant checks.

## What the automated checks cover

- Raw generated titles, descriptions, self-referencing canonicals, one H1, absolute social images, image dimensions/alt text, Open Graph and Twitter metadata.
- Parsed BlogPosting and BreadcrumbList JSON-LD; visible heading/date consistency; real image dimensions matching metadata.
- Full Markdown text and code in initial HTML; escaped raw HTML, logical headings, unique anchors and linked contents lists.
- Crawlable archive pagination/category navigation, related article/project links, author links, all generated internal href targets and fragment IDs.
- Public snapshot excludes a sentinel private draft and its image source; draft data is absent from HTML, JSON, XML and text exports. Sample article templates are not published.
- Sitemap and RSS entries follow publication/removal; tag/search/admin pages are excluded; noindex search/tag HTML and duplicate query response headers are checked.
- 301 trailing-slash/history/pagination responses, real missing/empty/archive 404s, deleted-article 410s, and noindex admin routes.
- Actual PostgreSQL migrations/RLS executed through PGlite with representative Supabase roles: anonymous draft exclusion, AAL1 rejection, non-admin rejection, AAL2 access, private records/files, immutable audit records and rate limits.
- Publication lifecycle preserves original legacy dates, first publication time, stable slugs, material modification dates and historical redirect chains. Metadata-only updates do not refresh modification dates. Historical URLs cannot be reused by another article. Deletes create 410 history.
- The private queue claims each pending batch once, records hook rejection as retryable failure, and clears a successful requested batch. Public clients cannot invoke privileged queue RPCs.
- The publishing handler rejects unsigned requests, AAL1 sessions, non-admins, invalid webhook secrets and non-Cloudflare destinations. No hook URL is returned to clients. A successful response says requested, not deployed.
- Contact/Lab consent, upload sizes/signatures, safe references, coordinate bounds, body limits, fixed email recipient, idempotency, provider failures and Turnstile hostname checking.
- Certificate draft/public CRUD policies, carousel wrapping, safe metadata, sample labeling and preserving existing owner edits/deletions during editor upgrades.

## Measured build size

The final `dist/seo-validation.json` records **129,084 raw bytes / 33,400 gzip bytes** for the initial public JavaScript and CSS graph. The CSS contributes 23,099 gzip bytes. Fonts and images are **additional** transfers. The two self-hosted WOFF2 font files total approximately 61.8 KB before HTTP compression. The authentication/contact SDK and face-detection code/model do not load initially for public article reading.

These are measured file sizes, not a browser performance score. No Lighthouse run, PageSpeed result, LCP, INP, CLS or field traffic measurement was obtained. Synthetic solid-color fixture images are not representative image-performance benchmarks. Do not infer a perfect score from these results.

## Not tested with live accounts/devices

- Actual Supabase migration execution, hosted Auth password/TOTP enrollment/login/recovery, JWT validation against a real project, hosted Storage policies and public REST queries. PGlite uses Supabase role/schema stand-ins, not hosted Supabase services.
- Vault/pg_net installation and real HTTP dispatch; deploy-hook delivery, selected branch rebuild, real Pages deployment success/rollback, account-level custom-domain redirects and live 301/404/410 behavior at the edge.
- A real publish → edit → rename → unpublish → delete sequence across all live services. The pieces pass local tests but the complete connected workflow still needs the acceptance checks in SEO_DEPLOYMENT.md.
- Google Rich Results Test, Schema.org's hosted validator, Search Console, actual crawl/indexing, and Open Graph/Twitter scraper caches. Local parsing is not a hosted-validator result.
- Physical Android/iOS devices, touch/swipe, screen-reader user testing, OS-level reduced-motion emulation and real network performance.
- Real certificate file uploads/enlarged-image interaction in this SEO session; the prior carousel work and current policy/rendering tests are included, but do not substitute for device testing with your own files.
- Real contact email/inbox delivery, attachment delivery, device-camera capture and location submission. No visitor data was collected and no real email sent.

## Operational limits to retain

- Article draft text/records are private through RLS and excluded from public generation. The existing public portfolio-media bucket is public, including images uploaded while preparing a draft; it is not a confidential asset store. Contact/Lab files use private storage.
- Public static changes take effect only after a successful build/deployment. The previous deployment persists after a failed build. Removing a previously public page/image cannot erase copies already fetched by others.
- Publishing status reports hook request acceptance, not build completion. Failed batches can be retried manually; a scheduled retry worker and deployment-success callback are not included.
- The included preview deliberately uses `SEO_INDEXABLE=false`, robots disallow-all and an empty sitemap. Enable production indexing only with the real HTTPS origin and configured backend.
- The public article sample count remains zero. Replace draft templates with original, reviewed work; fixture articles used in tests are never auto-published.
- No guarantee of rankings, indexing, email inbox delivery, liveness verification, or malware-free attachments is made.

## Version 2.1 contact and animation update

- Added the exact supplied Facebook and GitHub URLs to Contact cards, footer profiles and author-profile metadata. Other profiles are preserved.
- Browser verified the full-screen 4-panel intro with an active intro-slash animation, automatic cleanup, Replay, Skip and restored scrolling. Pausing motion disabled Replay; resuming enabled motion again.
- Browser verified both contact card hrefs and matching visible handles. Desktop document/client widths matched without horizontal overflow.
- Three new Node tests cover motion/autoplay guards, decorative/escaped markup, the 4-second fail-open paint guard and exact contact URLs. The publication test now also executes migration 0004 and checks preserved owner copy, no duplicate GitHub profile and retained additional links.
- The current size report includes the homepage-only intro-boot.js file as well as the shared initial public module/CSS graph. Fonts and images remain additional transfers.
- OS reduced-motion is handled in CSS and JavaScript and covered by the pure guard test; physical-device and OS preference emulation were not performed in this update. Hosted Supabase/Cloudflare publishing remains unconfigured for the portfolio backend. The owner-only design demo is deployed separately through Sites.

## Version 2.2 theme and Lab update

- Root cause fixed: applying the cream brand color as an inline --paper variable overrode the dark theme. Brand colors now use separate --brand-* variables. The saved/device theme is applied before first paint.
- Browser checked dark Home, Contact inputs, certificate text, Lab consent/simulation and local Studio; light mode restored the cream background and dark text correctly.
- Sampled computed dark-mode contrast: heading 15.96:1, Contact profile text 13.18:1, form input text 15.05:1, primary submit-button text 5.74:1. These are four desktop samples, not a claim of complete accessibility conformance.
- Browser checked simulated Lab countdown, explicit no-data/no-email completion copy and dialog closure. The real device-only test button and its disclosure were inspected, but real camera/GPS permission/capture was not exercised. No real photo, location or email was collected/sent.
- The browser transport disconnected once and recovered with a fresh session. Final dark-mode Lab rendering was visually inspected after recovery.
- Four new Deno handler tests execute the real multipart validation, rate/owner checks, private upload, mail formatting, database status and retry logic against a fake database/storage and mocked mail provider. They verify the photo attachment and coordinates, fixed owner address, rejection paths and accepted retry deduplication.
- Source review fixed camera setup/paused-frame timeouts and stale-attempt cleanup; physical-device camera behavior, real permissions, live storage, SMTP/provider delivery and inbox arrival remain untested.
- The frontend now distinguishes device-only results from connected email acceptance, and verifies the response status before showing acceptance. A server-configured integration test is still required before real collection/email sending.


## Version 2.2.2 — retain sections, remove instruction copy

Certificate and blog sections, their navigation links, contact form with attachment control, Studio link and optional Lab link remain available. Stock certificate records, upload/replace instructions, missing-resume note and public backend setup banner are removed. Empty certificate collections retain a visible section with a decorative graphic; real published images retain the existing animated carousel and accessible lightbox. No credentials or certificate images are invented.

Validation: 23 Node tests and raw HTML SEO checks; tests cover the persistent certificate section, rejected sample/missing/unpublished images, and real-image controls. Desktop browser review checks the restored section and navigation. Physical camera/GPS, live email delivery and mobile layout are not retested in this copy correction.


## Version 2.3.1 — live Supabase and GitHub setup

The portfolio schema and non-overwriting seed are installed in Supabase project xgtqpixoutlhqhflkpqs. Five migrations are tracked remotely and source filenames match the actual recorded versions. All eight portfolio tables have RLS enabled. submit-contact, submit-visit and request-publish are deployed and ACTIVE, with handler-level checks matching their config. The public API reads 15 published rows and excludes the three starter article drafts.

A normal build using live Supabase content passed raw HTML checks for 15 pages with self-referencing canonicals at https://nabikunwar.com.np. No content snapshot fallback is enabled. No real contact, camera/GPS or email submission was sent in setup checks.

Advisor follow-up: removed public/authenticated execution of the platform's rls_auto_enable event-trigger helper, preserving its DDL-trigger behavior. Consolidated SELECT policies per role without widening row access. The remaining authenticated is_portfolio_admin security-definer notice is intentional: the helper checks the caller's UID, allowlist membership and aal2, returns only a boolean, and is required by RLS. Private rate-limit and publish-queue tables intentionally have no anon/authenticated policies. The unused submissions index is retained for future real records.

Outstanding: no Auth user exists yet for nabinkunwar992@gmail.com; the owner must create it with a private password before allowlisting and TOTP enrollment. OPTIONS requests to the three functions return 403 because the production origin is not configured in ALLOWED_ORIGINS. Private backend secrets, deploy hook/Vault values and live inbox delivery still need verification. Browser access to the Supabase and Cloudflare dashboards requires sign-in. Cloudflare Pages deployment, custom-domain responses, host redirects and end-to-end publishing are not yet verified.


Final GitHub check: public repository read succeeds, but creating a Git blob returned 403 Resource not accessible by integration. The app installation uses selected repositories. No README bootstrap, Git tree, commit or branch update was created. The source is ready locally; GitHub write access still needs correction.

Final checks: 24 Node tests passed after applying and testing the privilege hardening, including anonymous/AAL1 rejection, AAL2 CRUD, upload validation, slug/publishing behavior and preview indexing guards. Live Supabase read checks and the real-data production build passed for 15 raw HTML pages; there are no published articles yet. CORS preflights remain rejected for the production origin until ALLOWED_ORIGINS is set.


Cloudflare sign-in attempt: the owner selected GitHub, then Google as the identity provider. Automatic approval review failed with a usage-limit error before the Google identifier step executed. No password or account identifier was entered by the assistant. The browser tab was unavailable on resume, so Cloudflare login/deployment remains incomplete. This review failure was not a determination that the action was unsafe.


Repository selection confirmed: GitHub app installation 119343345 currently includes only Nabi004646/codex. Add Nabi004646/portfolio to its selected repositories while retaining any existing selection. No other repository is used as a substitute.


Repository access update: installation 119343345 now includes both codex and portfolio. The target portfolio repository remains empty before the initial source upload. Prior GitHub 403 notes describe the resolved repository-selection issue; the source is being prepared for a fresh main branch.
