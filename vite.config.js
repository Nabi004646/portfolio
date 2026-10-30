import { defineConfig, loadEnv } from 'vite';
import { buildEnvironment } from './scripts/build-environment.mjs';

export default defineConfig(({mode}) => {
  const values = buildEnvironment({...loadEnv(mode, process.cwd(), ''),...process.env});
  const key = values.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key && !key.includes('YOUR_') && !/^sb_publishable_[a-z0-9_-]{20,}$/i.test(key)) throw new Error('Use a Supabase publishable key in the frontend. Secret and service-role keys must remain in Supabase.');
  for (const name of Object.keys(values)) if (name.startsWith('VITE_')&&/secret|service_role|password|resend_api/i.test(name)) throw new Error('A server-only secret was found in VITE_ configuration. Remove it before building.');
  if(values.SEO_INDEXABLE==='true'&&(!key||key.includes('YOUR_')||!values.VITE_SUPABASE_URL||values.VITE_SUPABASE_URL.includes('YOUR_')))throw new Error('Configure Supabase authentication before building an indexable production site.');
  return { define:{__PORTFOLIO_PREVIEW__:JSON.stringify(values.SEO_INDEXABLE!=='true')}, build: { target: 'es2022', sourcemap: false, manifest: true, rollupOptions: { input: { app: 'index.html', public: 'src/public-client.js' } } }, server: { allowedHosts: true } };
});
