export function publishingFeedback(data,{status=0,failed=false}={}){
  if(data?.code==='publishing_not_configured')return 'Saved in Supabase, but not published. Open Publishing and connect your Cloudflare production deploy hook.';
  if(status===401||status===403)return 'Saved in Supabase, but not published. Sign in again, verify your second factor, then retry from Publishing.';
  if(failed||!data?.ok)return 'Saved in Supabase, but not published. The build request failed; check Publishing and retry. Your saved content has been kept.';
  if(data.state==='requested')return `Saved in Supabase. Build requested for ${Number(data.count)||0} queued change(s). The live website updates only after Cloudflare finishes deployment.`;
  return 'Saved in Supabase. No pending public changes; drafts are not published.';
}
