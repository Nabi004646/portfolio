// Small, synchronous homepage paint guard. The page fails open after four seconds.
(()=>{const root=document.documentElement;try{
  if(location.pathname!=='/'||root.dataset.intro==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches||localStorage.getItem('nabin-motion')==='paused')return;
  if(sessionStorage.getItem('nabin-katana-seen-v1')==='1'&&!new URLSearchParams(location.search).has('intro'))return;
  root.classList.add('intro-pending');
  setTimeout(()=>{if(root.classList.contains('intro-pending')){root.classList.remove('intro-pending');root.dataset.introExpired='true';}},4000);
}catch{root.classList.remove('intro-pending');}})();
