# Nabin Kunwar — Portfolio

Personal portfolio with projects, a certificate carousel, a statically rendered blog at `/blog/article-slug/`, contact attachments and a password + TOTP content Studio. Built for Cloudflare Pages with Supabase Database, Auth, Storage and Edge Functions.

```bash
npm ci
npm run check:backend
npm run build
npm run dev
```

The public production configuration is in `.env.production`. Private credentials stay in Supabase Secrets. MediaPipe WASM is generated from the pinned npm dependency during the build; the small face model and its license are included. Camera/location access is optional, explicitly disclosed and independent of access to the portfolio.

See [DEPLOY_NABIKUNWAR.md](DEPLOY_NABIKUNWAR.md) for account setup and [VERIFICATION.md](VERIFICATION.md) for actual checks and outstanding live tests. [START_HERE.md](START_HERE.md) explains the source, and [SEO_DEPLOYMENT.md](SEO_DEPLOYMENT.md) covers publishing, redirects and sitemap generation.

The Supabase database schema and three Edge Functions were deployed on 30 October 2026. The full source is now uploaded to this GitHub repository on main. Cloudflare deployment and the remaining private account settings still need completion; function deployment alone is not proof of email delivery or a live custom domain. Starter articles remain drafts, and real certificate images come from the owner.
