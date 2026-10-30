# Nabin Portfolio — source and SEO build

Current production setup: see **[DEPLOY_NABIKUNWAR.md](DEPLOY_NABIKUNWAR.md)**. Version 2.3.1 includes your public Supabase/Turnstile settings and canonical domain in `.env.production`. A normal production build requires the real database migrations and seed to be installed. The Supabase schema and functions are now deployed. Private account settings and the Cloudflare rollout still need completion; the deployment guide and verification report record the remaining steps. Private credentials remain outside this archive.

This archive contains the complete editable source, a built **unpublished preview**, database migrations, backend functions, and checks. The Supabase database and backend functions are deployed; live email delivery and the Cloudflare website rollout are not yet verified. The portfolio and articles open directly; the explicitly disclosed camera/location experiment is optional on `/lab/`.

## Run locally

Use Node.js 22.12 or newer:

```bash
npm ci
npm run build
npm run dev
```

Open the localhost URL printed by the preview server (normally `http://localhost:4173`). `npm run dev` and `npm run preview` serve the generated HTML in `dist/`, including the real blog 301/404/410 behavior. Rebuild after changing source files. The included `dist/` already works without credentials, with indexing disabled.

For live code/content-editor experimentation, `npm run dev:spa` starts Vite with hot reload. **That SPA is a development tool; deploy the generated build.** Local Studio changes stay in that browser. To generate HTML from those edits, use Studio → Publishing → Export public content JSON, replace browser-only image references with files in `public/` or Supabase media, then:

```bash
CONTENT_SNAPSHOT=/absolute/path/to/public-content.json npm run build
```

Snapshots contain published content only; do not commit personal drafts or secret configuration. Unset `CONTENT_SNAPSHOT` for the live Supabase publishing workflow.

## Included

- Home, About, Contact with optional attachment, Projects and project details, certificate carousel, Privacy, Terms, author profile, and blog.
- Cream, cobalt, coral palette; clay/glass styling; parallax and motion controls; responsive layouts and reduced-motion support.
- Blog archives at `/blog/`, permanent articles at `/blog/article-slug/`, categories, numbered archive pages, related articles and explicitly selected relevant projects.
- Full article text, titles, author, dates, links, metadata and JSON-LD in initial HTML. Reading does not require JavaScript.
- Editable SEO and social fields, search estimate, private article preview, publication state, slug history, sitemap/RSS generation and rebuild queue.
- Studio CRUD for posts, projects, certificates, core/custom pages, navigation, sections, copy, colors and media. Essential settings records remain available.
- Supabase password + TOTP with an administrator allowlist and AAL2 database/storage policies. Local preview is clearly unauthenticated and uses no backend. An indexable production build requires Supabase configuration and disables the local Studio fallback.

See **[SEO_DEPLOYMENT.md](SEO_DEPLOYMENT.md)** for the publishing/rebuild setup and migration steps. See **[VERIFICATION.md](VERIFICATION.md)** for measured results and untested items. **[CONTENT_GUIDE.md](CONTENT_GUIDE.md)** contains the editorial checklist and topic ideas; the ideas are not published articles.

## Supabase and admin setup

1. Create a project in your own account. Run migrations `20261030121214_portfolio.sql`, `20261030121218_certificates.sql`, `20261030121222_seo_publishing.sql`, `20261030121225_contacts_and_intro.sql`, and `20261030121707_harden_portfolio_privileges.sql` in order. If upgrading, run only migrations not already applied.
2. Run `supabase/seed.sql` once after migrations. It adds missing records without replacing your edits. Starter blog posts remain private drafts. Certificate images must be supplied by the owner; no sample credentials are published.
3. Create your admin Auth user in Supabase, confirm its email, disable public sign-ups, and enable TOTP.
4. Add the intended user to the admin allowlist in the SQL editor:

```sql
insert into public.admin_members(user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
```

5. Copy `.env.example` to `.env.local` and configure the project URL and **publishable** key. Rebuild/restart. Visit `/admin/`, sign in, enroll your authenticator and verify its code. A password alone cannot read drafts, edit content, or read private submissions.
6. Supply your own password, authenticator codes and recovery information privately. No default account or bypass is included. Lost-authenticator recovery belongs in your Supabase account.

## Forms and optional Lab

Contact submissions store name, email, message and an optional PDF/JPG/PNG/WebP attachment (5 MB limit) privately in Supabase; the configured server emails a notification to the owner. The Lab has explicit disclosure and a Continue and capture action, local face detection, a countdown, cancellation, a single full-frame photo and location/accuracy. It is face presence detection, not identity or liveness verification. It never gates public articles.

Configure `supabase/.env.example` privately through Supabase Secrets, then deploy:

```bash
npx supabase login
npx supabase secrets set --env-file supabase/.env --project-ref YOUR_PROJECT_REF
npx supabase functions deploy submit-contact --project-ref YOUR_PROJECT_REF
npx supabase functions deploy submit-visit --project-ref YOUR_PROJECT_REF
npx supabase functions deploy request-publish --project-ref YOUR_PROJECT_REF
```

Required form settings: a Resend API key, verified `MAIL_FROM`, `OWNER_EMAIL`, exact `ALLOWED_ORIGINS`, random `IP_HASH_SECRET`, and the optional Turnstile server/site keys with allowed hostnames. Keep the public contact email consistent with `OWNER_EMAIL`. Hosted Supabase supplies its backend URL and service-role key to functions; neither goes into `VITE_*` or Cloudflare build configuration. Email API acceptance does not prove inbox delivery.

The three function entries use `verify_jwt=false` deliberately. Contact/Lab handlers check origin, bounded bodies, consent, inputs, upload signatures, rate budgets and optional Turnstile. The publishing handler independently verifies an AAL2 signed user session and admin membership, or an exact server-only webhook secret. It does not trust an unsigned role claim.

## Your content

Upload your real portrait, résumé PDF, certificate images and project screenshots in Studio. Replace sample slots and article drafts rather than treating them as earned credentials or personal experience. The initial bio and links come from your existing portfolio; review them before launch.

Published article dates come from the database lifecycle. Title edits keep the saved slug. Slug edits retain old URLs as permanent redirects after rebuilding. Changes to visible article content set its modification time; metadata-only changes and rebuilds do not refresh that date.

Public portfolio media uses the public media bucket, including images uploaded while editing a draft. Article draft **text and records** are protected by RLS and excluded from public HTML, search, RSS and sitemaps; public media URLs themselves are not confidential. Use only intended public portfolio images there. Contact attachments and Lab submissions use private storage. Previously published static content remains reachable until a successful replacement deployment; deleting email copies requires mailbox deletion separately.

## Before any public launch

Set the real HTTPS origin and `SEO_INDEXABLE=true`, connect the publish queue and Cloudflare deploy hook as described in SEO_DEPLOYMENT.md, and run the connected-project acceptance checklist. Keep preview deployments set to `SEO_INDEXABLE=false`. The default preview blocks crawling and has an empty sitemap; that is intentional.

Real deployment, account login/TOTP, live webhooks, email delivery and field performance need your accounts and devices. The implementation does not guarantee indexing or rankings.

## Contact links and katana intro

Facebook and GitHub are shown as personal contact cards and footer profiles. Edit Personal links / Social links in Studio → Site settings. Intro enabled, Intro title, Intro caption and Intro replay label are editable there too.

The homepage starts with a black screen, two fiery katana slashes and four panels opening to the portfolio. It plays once per browser tab, lasts about 2.2 seconds, and has Skip intro / Escape / Tab exits. Use Replay intro in the footer to see it again. Pause motion and the device reduced-motion preference disable it. If the enhancement fails to load, the black first-paint guard clears after four seconds. Article pages never autoplay the intro. There is no video, audio or new animation framework.

For an existing Supabase installation, apply migration 0004 once to add the supplied public contact profiles and intro defaults while preserving other settings. Published settings changes enter the existing publishing queue. The migration has been tested locally in PostgreSQL; hosted account integration remains untested.

## Version 2.2: dark mode and camera/location checks

Dark mode now separates your brand palette from theme surfaces, restores the saved theme before first paint, and uses readable text on forms, certificates, Studio panels and Lab dialogs. The toggle follows your saved choice; without one, it uses your device preference.

Open the footer → Camera & location lab. With no backend connected, choose the simulated walkthrough (no device permissions) or Test camera & location locally (explicit camera/location permissions, local face detection, a countdown and a device-only photo/coordinate preview). The local result is never uploaded or emailed and is discarded when you close it. Open the HTTPS site in its own browser tab when testing device permissions.

When Supabase and the email provider are connected, Continue and capture sends the consented photo and coordinates through submit-visit to the fixed server-side OWNER_EMAIL. Camera preview now starts while location is resolving, and capture/setup timeouts turn off the stream. An accepted response displays a reference; provider failure offers an idempotent retry. The browser never treats a device-only test as an email submission.

Real email delivery is still unconfigured in the hosted design demo. Set your public Supabase URL and publishable key in frontend build configuration, configure the private server settings from supabase/.env.example in your own Supabase Secrets, verify the sender domain in Resend, and deploy the updated submit-visit function. Do not put email/service-role secrets in VITE_* or share them in chat. Update any existing custom Privacy page with the distinction between local tests and connected submissions.

Additional backend verification:

```bash
npx --yes deno test --allow-env --allow-net supabase/functions/_shared/runtime_test.ts supabase/functions/_shared/publishing_test.ts supabase/functions/_shared/visit_test.ts
```

The new handler tests send synthetic multipart photo/coordinate fixtures to a mocked provider, covering private storage, a fixed recipient, acceptance, duplicate retries, provider rejection, invalid consent/coordinates/photos and storage/configuration failures. They do not send an actual email or verify inbox delivery.


Version 2.2.2: all navigation, the certificate section, blog section and contact form remain present. Only visitor-facing setup instructions and stock certificate content are removed. Real published certificate images activate the carousel and lightbox; before then, the section has its normal heading and a decorative graphic without upload instructions or invented credentials. Admin remains at /admin/ and the disclosed Lab at /lab/. The contact form needs Supabase for delivery and offers an honest, nontechnical email fallback on failure.
