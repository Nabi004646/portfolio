# SEO architecture and deployment

## Rendering and URL behavior

`npm run build` bundles shared code, fetches only published Supabase rows using the public publishable key, optimizes article images, generates complete HTML, then validates the result. A failed fetch, invalid required article field, blocked image host or failed validation aborts the build. It never silently deploys fallback articles after a backend error.

| URL | Behavior |
|---|---|
| `/blog/` | Crawlable first archive page |
| `/blog/page/2/` | Crawlable numbered page with its own canonical |
| `/blog/category/linux/` | Nonempty category archive; pagination uses `/page/2/` |
| `/blog/article-slug/` | Full article HTML with a self-referencing canonical |
| `/blog/article-slug` | 301 to its trailing-slash URL |
| Previous published slug | 301 to the current slug; multiple renames are flattened |
| Deleted published article | 410, including its historical aliases |
| Unpublished or unknown article | Real 404; drafts are never emitted |
| Empty tag/category, nonexistent page | Real 404 |
| Nonempty tag archives | `noindex,follow`; excluded from sitemap |
| `/blog/search/?q=…` | `noindex,follow`, public search index only |
| Duplicate filter/search query pages | HTTP `X-Robots-Tag: noindex,follow`; clean canonical |
| `?page=2` on an existing archive | 301 to the corresponding numbered path |
| `/admin/` | Public login shell only; protected data and operations require allowlisted AAL2 |

`functions/[[path]].ts` applies the blog/admin route manifest with real HTTP statuses, then delegates valid pages to Cloudflare's asset service. `_routes.json` restricts that function to blog/admin routes. A root `404.html` disables the old catch-all SPA fallback. `_redirects` contains only RSS/sitemap aliases, not a wildcard rewrite. Generated JSON-LD uses visible titles, body text, author, dates, category and actual image dimensions. No ratings or professional credentials are fabricated.

## Install or upgrade the database

Apply the five migration files in numerical order, skipping migrations already applied. Existing installations with certificate support need `20261030121222_seo_publishing.sql` and `20261030121225_contacts_and_intro.sql`, then the updated non-overwriting seed.

The SEO migration unpublishes labeled article samples, preserves valid original legacy dates from `data.date`, adds publication timestamps, reserves old URLs, and adds a private publishing queue. Existing non-sample published articles need unique SEO titles/descriptions, a real publication date, a featured image and alt text. Resolve duplicate metadata before applying unique indexes if your database already contains it. Back up your database before a real migration.

The initial seed contains no published articles. Write and review your own posts in Studio; do not publish a sample merely to populate the blog. An empty blog is noindex until it has actual articles.

## Cloudflare Pages

Use a **Git-connected Pages project** for automatic deploy hooks. Push this source, including the root `functions/` folder and scripts. Do not upload only `dist/` through drag-and-drop: that omits the required function compilation and repository rebuild workflow.

| Pages setting | Value |
|---|---|
| Root | The folder containing package.json |
| Build command | `npm run build` |
| Output folder | `dist` |
| Node | 22.12+; tested here on Node 24 |
| `VITE_SUPABASE_URL` | Your project HTTPS URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`, never a secret/service-role key |
| `PUBLIC_SITE_URL` | Your real portfolio HTTPS origin, without a path |
| `VITE_SITE_URL` | The same origin, for the Studio estimate |
| `SEO_INDEXABLE` | `true` for the intended public production deployment; `false` for previews |
| `VITE_TURNSTILE_SITE_KEY` | Optional public widget key |
| `IMAGE_SOURCE_HOSTS` | Optional comma-separated HTTPS image hostnames you control/trust |

Use the same portfolio domain for `/blog/`. Supabase and your site hostname are image-source allowlisted automatically. External featured and Markdown image sources must be explicitly allowlisted; redirects to other image hosts are rejected. A broken source image fails the build. Optimized article assets are generated locally with real dimensions and responsive WebP variants. Fonts are self-hosted WOFF2 with `font-display:swap`. Article/public reading does not initially load authentication, contact SDK, or face-detection assets.

Configure the custom domain through your own Cloudflare account. Redirect any alternate host (such as a Pages subdomain or www alias) to the chosen canonical origin using your Cloudflare domain/redirect configuration if you intend to expose it. That account-level host redirect is not configured here. On launch, fetch `view-source:` or use curl to verify the deployed HTML and robots policy.

## Automatic rebuilds from Supabase

1. Create a Cloudflare Pages deploy hook for the production branch. Its URL is a credential. Store it **only in Supabase Secrets** as `CLOUDFLARE_DEPLOY_HOOK`.
2. Generate a separate random secret of at least 32 characters (for example `openssl rand -hex 32`). Store it as Supabase Secret `PUBLISH_WEBHOOK_SECRET`. Never use your service-role key as the webhook secret.
3. Deploy `request-publish` along with the migrations. The handler only posts to HTTPS Cloudflare deploy-hook URLs; clients cannot supply a destination.
4. In Supabase Vault, create these two secrets privately:

| Vault name | Value |
|---|---|
| `portfolio_publish_url` | `https://YOUR_PROJECT.supabase.co/functions/v1/request-publish` |
| `portfolio_publish_secret` | Exactly the same value as `PUBLISH_WEBHOOK_SECRET` |

5. Run `supabase/setup/publishing-webhook.sql` in your own SQL editor. It enables `pg_net` and dispatches an async authenticated request whenever a public content change enters the queue. The scoped secret may be accessible to privileged database operators through Vault/HTTP queues; it has no database service-role authority.
6. Add the exact portfolio origin to `ALLOWED_ORIGINS` so the authenticated Studio retry action can call the function. Browser requests verify signed claims, active user identity, AAL2 and admin membership. Database webhooks use the scoped secret without a browser Origin header.
7. Publish a real reviewed article. Studio saves through RLS, then requests a build; the database trigger also covers changes made outside Studio. Atomic queue claiming prevents the same pending batch from being processed twice concurrently. Other queued changes may correctly request additional builds.
8. Check Studio → Publishing and Cloudflare's deployment log. **Requested means the hook accepted a request, not that a deployment succeeded.** A failed hook leaves a retryable batch. Use Request / retry build after fixing server configuration. There is no scheduled retry daemon or deployment-success webhook included.

Published content updates, renames, unpublishes, deletes and public settings/project changes enqueue rebuilds. A never-published draft save does not need a rebuild. Every successful build regenerates sitemap, feed, archives, author links and route history from the public snapshot.

The previous deployment remains served while a new one builds, and if the new build fails. Unpublishing is not an immediate revocation of an already public static page or cached image. Verify the successful deployment before treating the old page as removed. Restoring an old Cloudflare deployment can restore its old URLs/content; review the snapshot before rollback.

## Studio workflow

- Write a draft around one reader question. Store your actual experiment notes and reliable sources. Use Markdown H2/H3 headings, lists, fenced code and descriptive image alt text. Raw HTML is escaped.
- Choose the slug once. Editing the title of a saved article preserves it. A renamed published slug creates 301 history after deployment; another article cannot reuse that historical URL.
- Edit SEO title, meta description, featured image/alt, social title/description/image/alt, category, tags, related project slugs and publication state. Image dimensions are recomputed from the actual files during generation.
- Search preview character counts are editing estimates. Google may choose different snippets.
- Content preview stays in the authenticated Studio DOM; it is not a public draft URL.
- First publication is recorded once. A visible-content edit changes the modification time; an SEO-title-only edit, reordering or rebuild does not. Legacy published articles without a known date must supply their genuine original date rather than receiving the build date.
- Publish/update, wait for the successful deployment, then inspect the public URL and sitemap. Unpublish or delete and confirm the new 404/410 after deployment.

Article text/draft rows are private under RLS. The existing public portfolio-media bucket is intended for public assets, including images uploaded while editing a draft; it is not a confidential draft-asset store. Contact and Lab uploads remain private.

## Discovery and validation

- Production `robots.txt` allows crawling and advertises the sitemap. Noindex routes are crawlable so their exclusion directives can be read. Preview builds disallow all crawling and emit no sitemap entries.
- `sitemap.xml` includes only eligible public canonical pages. Article lastmod uses genuine content/publication dates, not build time. Deleted/draft/noindex posts and tag/search/admin pages are excluded.
- `rss.xml` contains eligible published article links, descriptions and genuine publication dates. `/rss` redirects to it.
- The SVG favicon is served locally. About, Contact, Privacy and the author profile are real generated pages; review the legal copy for your final operation.
- Optional `llms.txt` can be enabled in SEO & author profile settings. It is a text aid, not a search-ranking requirement.

Local commands:

```bash
npm run build
npm test
npm run check:seo
npx --yes deno check supabase/functions/request-publish/index.ts supabase/functions/submit-contact/index.ts supabase/functions/submit-visit/index.ts
npx --yes deno test --allow-env --allow-net supabase/functions/_shared/runtime_test.ts supabase/functions/_shared/publishing_test.ts
npx --yes wrangler pages functions build functions --outdir /tmp/portfolio-worker-check --compatibility-date 2026-10-30
```

`dist/seo-validation.json` records actual raw/gzip initial public JS/CSS bytes and raw-HTML checks. `dist/seo-build-report.json` records article/page/sitemap/redirect counts. These are build artifacts, not a Lighthouse score or a ranking prediction.

Connected-project acceptance checks, not executed here:

1. Test your real admin password/TOTP, AAL1 rejection, non-admin rejection, Storage permissions, and anonymous draft queries.
2. Publish, edit only SEO, edit body, rename twice, unpublish and delete a controlled test article. Verify the dates, 301 targets, real 404/410 statuses and changed sitemap/RSS after each successful deploy. Confirm historical slugs cannot be taken by another post.
3. Confirm the Vault/pg_net trigger dispatches a real event, the function verifies it, Cloudflare rebuilds the selected branch and the finished deployment contains the expected HTML. Test a rejected hook and a build failure, then retry.
4. Run Google's Rich Results Test and a Schema.org validator against the deployed URL. Fetch its raw HTML independently, then check canonical, metadata, images and internal links.
5. Test Open Graph/Twitter preview scrapers, real mobile devices and assistive technology; measure Lighthouse/PageSpeed plus field LCP, INP and CLS once you have traffic. Record actual results rather than promising perfect scores.
6. If you choose to launch, verify your chosen canonical host, robots and sitemap; then optionally submit the sitemap in your own Search Console account. Submission does not guarantee indexing.

## Primary documentation

- [Cloudflare deploy hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/)
- [Cloudflare Pages asset serving and 404 handling](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Cloudflare Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Supabase database webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)
- [Google article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google paginated content](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
