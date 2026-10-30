export async function routePolicy(request,manifest,assets) {
  const url=new URL(request.url);const path=url.pathname;
  const headers={'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
  if(path==='/admin'||path==='/admin/'){
    if(path==='/admin')return new Response(null,{status:301,headers:{Location:'/admin/'}});
    const response=await assets(request);const clone=new Response(response.body,response);clone.headers.set('X-Robots-Tag','noindex, nofollow');clone.headers.set('Cache-Control','no-store');return clone;
  }
  if(path.startsWith('/admin/'))return new Response(manifest.errorHtml,{status:404,headers:{...headers,'X-Robots-Tag':'noindex'}});
  if(path==='/blog'||path.startsWith('/blog/')){
    if(url.searchParams.has('page')&&/^\d+$/.test(url.searchParams.get('page'))){const page=Number(url.searchParams.get('page'));const base=path.replace(/\/page\/\d+\/?$/,'/').replace(/\/?$/,'/');const target=page>1?`${base}page/${page}/`:base;if(manifest.routes[target]?.status===200)return new Response(null,{status:301,headers:{Location:target}});}
    const canonical=path==='/'?'/':path.replace(/\/?$/,'/');const route=manifest.routes[canonical];
    if(route?.status===301)return new Response(null,{status:301,headers:{Location:route.target,'Cache-Control':'public, max-age=300'}});
    if(route?.status===410)return new Response(manifest.goneHtml,{status:410,headers:{...headers,'X-Robots-Tag':'noindex,follow'}});
    if(!route||route.status!==200)return new Response(manifest.errorHtml,{status:404,headers:{...headers,'X-Robots-Tag':'noindex,follow'}});
    if(path!==canonical)return new Response(null,{status:301,headers:{Location:canonical+url.search}});
    const response=await assets(request);const result=new Response(response.body,response);
    if(canonical==='/blog/search/'||['q','search','tag','category','sort','filter'].some(key=>url.searchParams.has(key)))result.headers.set('X-Robots-Tag','noindex,follow');
    return result;
  }
  return assets(request);
}
