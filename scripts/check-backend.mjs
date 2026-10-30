import {loadEnv} from 'vite';

// Read-only checks: never request camera/GPS, submit a form, or send email.
const env={...loadEnv('production',process.cwd(),''),...process.env};
const base=env.VITE_SUPABASE_URL?.replace(/\/$/,'');
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base||'')||!/^sb_publishable_/.test(key||''))throw new Error('Set the public Supabase project URL and publishable key.');
let failed=false;
for(const [name,query] of [['content_items','select=id&is_published=eq.true'],['site_routes','select=source_path&limit=1']]){
  try{
    const response=await fetch(`${base}/rest/v1/${name}?${query}`,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
    if(!response.ok){failed=true;console.error(`${name}: HTTP ${response.status}. Apply the portfolio migrations and seed in the selected Supabase project.`);continue;}
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error('Unexpected response shape');
    if(name==='content_items'){
      const missing=['settings','home','about','contact','layout'].filter(id=>!rows.some(row=>row.id===id));
      if(missing.length){failed=true;console.error(`content_items: missing published records ${missing.join(', ')}. Run the non-overwriting seed.`);continue;}
    }
    console.log(`${name}: public read policy reachable (${rows.length} row${rows.length===1?'':'s'} checked).`);
  }catch(error){failed=true;console.error(`${name}: ${error.name==='TimeoutError'?'request timed out':error.message}`);}
}
console.log('These checks do not verify admin authentication, private policies, Edge Function secrets, email delivery or a Cloudflare deployment.');
if(failed)process.exitCode=1;
