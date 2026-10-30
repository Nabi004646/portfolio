// Restore the theme before CSS paints; no account or submission data is read.
(()=>{try{const saved=localStorage.getItem('nabin-theme');document.documentElement.dataset.theme=['light','dark'].includes(saved)?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch{document.documentElement.dataset.theme='light';}})();
