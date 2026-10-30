# Verification — 30 October 2026

This report covers source/build tests, earlier private browser checks, and the live Supabase installation. The public Cloudflare website is not deployed or verified yet.

## Completed

| Check | Actual result |
| --- | --- |
| Source tests | 24 passed, 0 failed |
| Live-data production build | Passed; 17 HTML files generated and 15 successful HTML routes validated |
| Hosted Supabase migrations | Five applied; source filenames match the remote migration history |
| Hosted table protection | RLS enabled on all eight portfolio tables |
| Public data reads | 15 published records reachable; three starter articles remain drafts |
| Edge Functions | submit-contact, submit-visit and request-publish deployed and ACTIVE |
| GitHub | Full source uploaded to main; application commit 4c6569dbeff0a66fbd9c0118fb1931f3d42d8c10 contains 92 files |
| Published article count | Zero; no sample article was auto-published |

The source tests exercise PostgreSQL policies using PGlite/Supabase-role stand-ins, public draft exclusion, AAL1 rejection, AAL2 allowlisted CRUD, private submissions/files, upload signatures and sizes, immutable audit records, rate budgets, publication dates, slug history and queued rebuild requests. They also cover persistent certificate sections, sample/missing-image rejection, real-image carousel controls, intro motion guards, public contact URLs, theme restoration and noindex Cloudflare preview branches.

Synthetic article checks cover eight fixture posts across 35 successful routes: complete initial HTML, unique SEO metadata, canonical links, JSON-LD, author/dates, real image dimensions and srcsets, category/pagination/internal links, sitemap/RSS exclusion and real 301/404/410 route responses. Fixture posts are not deployed.

The earlier backend Deno suite passed 13 tests and type checks for all three handlers, with network providers mocked. No live email delivery is implied by those results. The earlier local Cloudflare routing-function compilation passed; an actual Pages deployment remains unverified.

## Browser checks already performed

Earlier desktop browser reviews covered Home, About, Contact, certificate headings, the optional Lab's simulated walkthrough and local Studio in dark mode. The cream brand variable no longer overrides the dark surface. Sampled computed contrast was 15.96:1 for a heading, 13.18:1 for Contact profile text, 15.05:1 for form input text and 5.74:1 for the primary button. These are four desktop samples, not a complete accessibility audit.

Prior synthetic article rendering at 390px and 768px frame widths had no horizontal overflow. That was a viewport harness, not a physical phone/touch test. Real mobile camera permissions, touch/swipe behavior, screen-reader use and OS-level motion preferences were not tested.

The certificate and blog sections, navigation, contact form with attachment control, Studio and optional disclosed Lab remain present. Only instructional template wording and sample credentials were removed. The certificate carousel/lightbox uses the owner's real published images. No real certificate image has been supplied in this session.

## Measured initial assets

The production build report records **129,084 raw bytes / 33,400 gzip bytes** for initial public JavaScript and CSS. CSS contributes 23,099 gzip bytes. Fonts and images are additional transfers; the two self-hosted WOFF2 fonts total about 61.8 KB before HTTP compression. Authentication/contact SDK and face-detection code/model are not loaded initially for public article reading.

These are file sizes, not Lighthouse, PageSpeed or field Core Web Vitals scores. No LCP, INP or CLS measurement was obtained.

## Database advisor review

Removed anonymous/authenticated execution of the platform's rls_auto_enable event-trigger helper while preserving its DDL-trigger behavior. Consolidated SELECT policies per role without widening row access. Live privilege checks confirm anonymous users cannot select private submissions or execute that platform helper.

The remaining [authenticated security-definer notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) is intentional for is_portfolio_admin: it checks the caller's UID, allowlist membership and aal2, returns only a boolean and is required by the RLS policies.

The [no-policy informational notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) concern internal rate-limit and publish-queue tables. They deliberately have no anon/authenticated policies. The [unused-index notice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) concerns a new submissions index retained for future real records.

## Remaining setup and tests

- Production-origin OPTIONS requests to all three functions return 403 until ALLOWED_ORIGINS is configured. Turnstile hostnames, replacement secret, private hash secret, Resend settings and deploy-hook secrets still need account-level verification.
- The admin Auth user nabinkunwar992@gmail.com does not yet exist. It must be created and confirmed privately before running authorize-nabin.sql and enrolling TOTP. Live login, recovery and allowlisted editing are untested.
- Cloudflare has not reported a deployment check for the source commit. Last endpoint checks returned 404 for nabikunwar.com.np and 522 for portfolio-17x.pages.dev. Domain/DNS changes, production deployment and alternate-host redirects remain incomplete.
- The attempted dashboard login stopped at a secure sign-in step because automatic approval review hit a usage limit. No login credential was entered. This was a review failure, not an unsafe-action determination.
- Vault/pg_net publishing dispatch, the real deploy hook, finished Pages rebuild and publish/edit/rename/unpublish/delete acceptance sequence remain untested. Hook acceptance alone is not deployment success.
- No real message, attachment, camera image, GPS location or email was submitted during these setup checks. Actual inbox delivery, device capture and storage integration still need explicit end-to-end tests.
- Hosted schema validators, Search Console, indexing, social scraper caches and physical-device performance are untested.

Private keys are absent from frontend/GitHub source. The public Supabase publishable key and Turnstile site key are intentionally included. The portfolio-media bucket is public, including assets prepared for drafts; contact/Lab files use private storage. Static changes become effective only after a successful deployment, and old deployments/cached copies may preserve previously public content. No ranking, indexing, email-delivery or identity/liveness guarantee is made.
