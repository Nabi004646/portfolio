// Never let a Cloudflare preview branch produce indexable production HTML.
export function buildEnvironment(values) {
  const resolved = { ...values };
  if (resolved.CF_PAGES === '1' && resolved.CF_PAGES_BRANCH !== (resolved.PORTFOLIO_PRODUCTION_BRANCH || 'main')) {
    resolved.SEO_INDEXABLE = 'false';
  }
  return resolved;
}
