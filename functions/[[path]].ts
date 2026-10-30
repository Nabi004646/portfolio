import manifest from './_generated/routes.json';
import {routePolicy} from '../src/seo/route-policy.js';

// Static article files remain the content source. This thin handler enforces
// permanent redirects, removed-article 410s, real unknown-article 404s, and noindex
// for search/filter variants. It contains no Supabase or deployment credentials.
export async function onRequest(context:{request:Request;env:{ASSETS:{fetch(request:Request):Promise<Response>}}}){
  return routePolicy(context.request,manifest,(request:Request)=>context.env.ASSETS.fetch(request));
}
