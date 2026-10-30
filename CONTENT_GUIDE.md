# Writing useful portfolio articles

The existing portfolio describes you as a web developer and cybersecurity student with Linux and Android interests. These are ideas to validate against your own knowledge, not claims that you have already performed the work. No new article is automatically published.

| Reader question | An original article you could prepare | Evidence to gather yourself |
|---|---|---|
| Why does a direct blog URL return 404 on a static host? | Compare your portfolio's old SPA route and generated `/blog/article-slug/` route | Your own deployment configuration, raw HTML and real response headers |
| How do I keep Supabase drafts private? | Demonstrate a small read-policy lab in a project you own | Anonymous versus AAL1/AAL2 queries, sanitized results, policy SQL and limitations |
| How do I add TOTP to an admin panel? | Walk through your own portfolio's authenticator flow | Your own setup screenshots with QR secrets/codes removed, rejection tests, recovery process |
| How do I inspect DNS and HTTPS problems on Linux? | Reproduce one issue you encountered in a disposable environment | Linux/distro versions, actual `dig` and `curl -I` output, the cause and checked fix |
| How can I validate an uploaded image safely? | Explain MIME, signature, size checks and what they do not prove | Small synthetic fixtures and your own validation results; avoid claiming malware scanning |
| How do I make a certificate carousel keyboard accessible? | Explain your project's controls, pause behavior and image descriptions | Your actual implementation, keyboard checks, reduced-motion behavior, screenshots |
| Why does a website request camera permission on Android? | Explain a permission flow tested on your own Android browser | Device/browser versions, permission-denial behavior, local-versus-server processing and cancellation |
| How can I test an Android app's networking in my own lab? | Use an app/device and network you own or are authorized to test | Sanitized logs, reproducible setup, test boundaries and reliable platform documentation |

Use an idea only after you can answer it accurately. Prefer a narrow, reproducible finding over a broad headline such as “Everything about cybersecurity.” Do not invent years of experience, certificates, benchmark wins, client outcomes or experiments.

## Article checklist

1. Put the specific reader question in the draft's Reader question field. State the answer and applicable versions near the start.
2. Explain prerequisites and the precise steps a reader can reproduce. Include actual code/commands, expected output and one useful failure case.
3. Add your own screenshots where they clarify the result. Remove keys, session tokens, personal addresses, QR enrollment secrets and other confidential information before uploading public media.
4. Distinguish your own observations from facts learned from sources. Link the exact primary documentation/research you used, and explain limits instead of implying universal behavior.
5. Use one article title and descriptive H2/H3 headings. The renderer supplies the main H1, normalizes skipped body heading levels and adds a linked contents list for four or more main subsections.
6. Select only relevant project links, categories, tags and related examples. Never repeat keywords just to increase frequency.
7. Give the article a unique, accurate SEO title and meta description. Keep its slug when changing its headline. Preview the social image and provide meaningful alt text.
8. Review the actual publication/modification dates, author page and sources. Publish only when the article answers its question; there is no target word count.
9. After the successful build, read the article on a phone, follow its links and check its raw HTML. Fix errors promptly; material changes receive a real modification date.

Reliable starting points include [Supabase documentation](https://supabase.com/docs), [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/), [Linux kernel documentation](https://docs.kernel.org/), [Android developer documentation](https://developer.android.com/docs), and [MDN's web platform documentation](https://developer.mozilla.org/). Link the relevant specific page you checked in each article, not just these homepages.
