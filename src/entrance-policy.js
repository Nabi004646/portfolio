// Presentation policy only: published HTML and assets remain public.
export function isEntranceRoute(path='/'){
  const route=path.replace(/\/+$/,'')||'/';
  return !/^\/(admin|privacy|terms|lab)(\/|$)/.test(route)&&!/[.][a-z0-9]+$/i.test(route);
}
