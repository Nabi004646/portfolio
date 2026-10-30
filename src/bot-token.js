// Keep time spent granting permissions/loading the camera out of token reuse.
export function createBotToken({now=Date.now,maxAge=240000}={}){
  let value='',expires=0;
  return {
    set(next){value=typeof next==='string'?next:'';expires=value?now()+maxAge:0;},
    token(){return now()<expires?value:'';},
    expiresAt(){return expires;},
    clear(){value='';expires=0;},
  };
}
export function usableBotToken(value,expiresAt,now=Date.now()){
  return typeof value==='string'&&value.length>0&&Number.isFinite(expiresAt)&&now<expiresAt;
}
