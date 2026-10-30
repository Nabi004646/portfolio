export function botErrorMessage(value){
  const code=/^\d{6}$/.test(String(value))?String(value):'unknown';
  if(['400020','110100','110110'].includes(code))return `Cloudflare cannot start verification: this website's public widget key is invalid (${code}). The site owner must update it.`;
  if(code==='110200')return `Cloudflare has not authorized this website's domain (${code}). The site owner must update the widget's allowed domains.`;
  return `Cloudflare verification could not finish (code ${code}). Restart verification. If it still fails, try another browser or contact the site owner.`;
}
