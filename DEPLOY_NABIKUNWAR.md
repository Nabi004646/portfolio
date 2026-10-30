# Deployment for nabikunwar.com.np

The public frontend settings are already in `.env.production`. It is safe to commit that file: it contains only the Supabase publishable key, project URL, Turnstile site key and website origins. No private key is included. The production build reads published content from Supabase and deliberately fails if the database is unavailable or uninitialized.

## 1. Database

Selected project: `xgtqpixoutlhqhflkpqs` (`https://xgtqpixoutlhqhflkpqs.supabase.co`). The database and seed are now installed. Five migrations are recorded remotely; the source filenames match their recorded versions. All eight portfolio tables have row-level security enabled. The three Edge Functions are deployed and active. Read-only CORS preflight tests return 403 until the live ALLOWED_ORIGINS secret includes the production origin.

Preferred connected workflow: inspect the remote project and its migration history, apply the existing migrations in order, and execute the non-overwriting `supabase/seed.sql`. Do not apply a migration twice.

If using the SQL Editor on this fresh project instead, run `supabase/setup/install-fresh-project.sql` once. It uses one transaction and refuses to run when the portfolio table exists. This SQL Editor path does not record CLI migration history. Before subsequently using `supabase db push`, reconcile the applied versions through the CLI's migration-history repair flow; do not run the same migration DDL again.

Then run `npm run check:backend`. It performs only public read checks; it does not submit forms or send mail.

## 2. Administrator

In Supabase Authentication, create and confirm `nabinkunwar992@gmail.com`. Set its password privately. Disable public sign-ups for this owner-only site and set the Auth Site URL to `https://nabikunwar.com.np`.

Run `supabase/setup/authorize-nabin.sql`. It refuses to authorize a missing or unconfirmed user, and adds only that email's user ID to the admin allowlist. At `https://nabikunwar.com.np/admin/`, sign in, enroll an authenticator and verify its code. A password alone does not grant private content or editing access.

## 3. Backend secrets and functions

Use `supabase/secrets.production.example` as the field checklist in Edge Functions > Secrets. Enter actual secrets privately. Regenerate the Turnstile secret that was supplied in chat, then save its replacement as `TURNSTILE_SECRET_KEY`. Never copy it into a VITE variable or commit it.

Known public values:

| Setting | Value |
| --- | --- |
| `MAIL_FROM` | `Nabin Portfolio <portfolio@nabikunwar.com.np>` |
| `OWNER_EMAIL` | `nabinkunwar992@gmail.com` |
| `ALLOWED_ORIGINS` | `https://nabikunwar.com.np,https://portfolio-17x.pages.dev` |
| `TURNSTILE_HOSTNAMES` | `nabikunwar.com.np,portfolio-17x.pages.dev` |

`TURNSTILE_HOSTNAMES` can be an explicit comma-separated hostname override. When empty, the backend derives exact HTTPS hostnames from `ALLOWED_ORIGINS`; malformed origins and URLs containing paths are excluded. Server-side token verification remains required.

Required private values: `RESEND_API_KEY`, replacement `TURNSTILE_SECRET_KEY`, random `IP_HASH_SECRET`, Pages `CLOUDFLARE_DEPLOY_HOOK`, and separate random `PUBLISH_WEBHOOK_SECRET`. Generate the two random secrets independently with `openssl rand -hex 32` on your own machine. The hosted Supabase runtime supplies its service-role credentials; do not put them in the frontend.

Deploy `submit-contact`, `submit-visit` and `request-publish`, including their `_shared/` dependencies, using `supabase/config.toml`. These handlers perform their own origin, consent, bot/rate, or signed-admin checks; the entries intentionally use `verify_jwt=false`. Use the connected Supabase deployment tools or consult CLI `--help` before using its deployment commands.

Configure the Turnstile widget to allow `nabikunwar.com.np` and `portfolio-17x.pages.dev`. Keep `REQUIRE_TURNSTILE=true` on the live functions. The optional Lab keeps its visible collection/email disclosure and is independent of portfolio access.

## 4. GitHub and Cloudflare Pages

Repository: `https://github.com/Nabi004646/portfolio`. The connected GitHub app now includes portfolio and the default branch is main. The complete source is uploaded on main, with files at the repository root. The public production settings can be committed; private credentials stay outside Git.


Use a Git-connected Pages project for automatic blog rebuilds. If the existing project was created with Direct Upload, Cloudflare requires a new Git-connected project; do not delete the existing project while setting this up. Move the custom domain only after verifying the new deployment. If the new Pages hostname differs, update ALLOWED_ORIGINS and TURNSTILE_HOSTNAMES accordingly.

Build settings:

| Pages setting | Value |
| --- | --- |
| Project | `portfolio` |
| Production branch | `main` (or update `PORTFOLIO_PRODUCTION_BRANCH` to match the actual branch) |
| Root directory | repository root |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22.12.0` or a later compatible Node 22 release |
| Custom domain | `nabikunwar.com.np` |
| Existing Pages hostname | `portfolio-17x.pages.dev` |

The public defaults are in `.env.production`; dashboard variables override them. Set `SEO_INDEXABLE=false` for preview deployments. The build also forces non-production Cloudflare branches to noindex. Keep `CONTENT_SNAPSHOT` unset in Cloudflare so every publishing deployment reads the live published database. Do not deploy a manually uploaded `dist` alone: the repository's `functions/` folder supplies blog 301/404/410 handling.

Add the custom domain in this existing Pages project's Custom domains settings. Configure an account-level redirect from `portfolio-17x.pages.dev` and any chosen www alias to `https://nabikunwar.com.np`, preserving paths and queries. Those DNS/host settings are account operations, not already completed by this source change.

## 5. Automatic article publishing

Create a deploy hook on the Pages production branch; store the URL privately as `CLOUDFLARE_DEPLOY_HOOK`. Set `PUBLISH_WEBHOOK_SECRET` independently of all API keys. In Supabase Vault, add:

- `portfolio_publish_url`: `https://xgtqpixoutlhqhflkpqs.supabase.co/functions/v1/request-publish`
- `portfolio_publish_secret`: the same private value as `PUBLISH_WEBHOOK_SECRET`.

Then run `supabase/setup/publishing-webhook.sql` once after checking that its trigger does not already exist. Studio publishing changes then enter the queue and request a Pages rebuild. Check the finished Pages deployment: a successful hook request alone is not deployment success.

## 6. Acceptance checks before launch

- Confirm `npm run check:backend`, `npm test` and a normal `npm run build` pass against live published data.
- Check sign-in, TOTP enrollment, allowlisted CRUD and rejection of unauthenticated/low-assurance access.
- Upload a real certificate image; check the carousel and enlarged image. Certificate and blog sections remain visible; setup instructions remain absent.
- Submit an explicitly identified test contact message; check private storage, email-provider acceptance and the actual Gmail inbox. Do not treat API acceptance as proof of inbox delivery.
- Test the optional camera/location Lab yourself with its disclosures. This setup work does not capture device data or send a real photo/location email.
- Publish a reviewed article, change its title, rename its slug, then unpublish it. Check deployment completion, canonical HTML, sitemap/RSS, redirects and 404/410 responses.
- Check the custom domain, mobile layout, robots policy and alternate-host redirect.

Profile photos, real certificates, résumé, project screenshots and original articles still come from the owner's uploads and review. No credentials or personal experience are invented.


## Current next actions

1. Connect Cloudflare Pages project portfolio to this repository, using main, build command npm run build and output directory dist.
2. Set the Supabase Edge Function Secrets shown above, including ALLOWED_ORIGINS and TURNSTILE_HOSTNAMES. Complete the remaining private values without putting them into Git.
3. Create and confirm the admin Auth user privately, then run authorize-nabin.sql and enroll TOTP.
4. Configure the custom domain and deployment hook, install the Vault publishing trigger once, and verify live delivery/publishing.

## Homepage entrance update

The published settings now enable `entranceRequired`. On the first homepage visit in a tab, a disclosed Agree & Start flow appears before the katana animation. There is no Skip control for entry. Cancellation or failure keeps the homepage covered with a retry prompt. Only an accepted submission response opens the homepage and starts the animation; this records email-service acceptance, not inbox delivery. Privacy, admin, articles and the independent Lab remain reachable. This browser presentation flow does not protect downloadable public assets or verify identity.

The submission backend was returning 503 because `IP_HASH_SECRET` was absent, too short or a placeholder. Set a private random value in Supabase Edge Function Secrets before testing delivery. Administrator membership for the confirmed owner account is now installed; the owner still enrolls and completes TOTP privately.
