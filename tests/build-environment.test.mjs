import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEnvironment} from '../scripts/build-environment.mjs';

test('Cloudflare preview branches cannot enable indexing; explicit production settings stay intact',()=>{
  const production={CF_PAGES:'1',CF_PAGES_BRANCH:'main',SEO_INDEXABLE:'true',PUBLIC_SITE_URL:'https://nabikunwar.com.np'};
  assert.equal(buildEnvironment(production).SEO_INDEXABLE,'true');
  assert.equal(buildEnvironment({...production,CF_PAGES_BRANCH:'feature/test'}).SEO_INDEXABLE,'false');
  assert.equal(buildEnvironment({...production,CF_PAGES_BRANCH:undefined}).SEO_INDEXABLE,'false');
  assert.equal(buildEnvironment({...production,CF_PAGES_BRANCH:'release',PORTFOLIO_PRODUCTION_BRANCH:'release'}).SEO_INDEXABLE,'true');
  assert.equal(buildEnvironment({...production,SEO_INDEXABLE:'false'}).SEO_INDEXABLE,'false');
  assert.equal(production.SEO_INDEXABLE,'true');
});
