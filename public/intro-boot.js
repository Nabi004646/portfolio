// Synchronous entrance paint guard. Only the optional animation times out.
(()=>{const root=document.documentElement;try{
  let reference='';try{reference=sessionStorage.getItem('nabin-entrance-reference-v1')||'';}catch{}
  if(root.dataset.entrance==='required'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)){root.classList.add('entrance-pending');return;}
  if(location.pathname!=='/'||root.dataset.intro==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches||localStorage.getItem('nabin-motion')==='paused')return;
  if(sessionStorage.getItem('nabin-katana-seen-v1')==='1'&&!new URLSearchParams(location.search).has('intro'))return;
  root.classList.add('intro-pending');
  setTimeout(()=>{if(root.classList.contains('intro-pending')){root.classList.remove('intro-pending');root.dataset.introExpired='true';}},4000);
}catch{root.classList.remove('intro-pending');}})();
