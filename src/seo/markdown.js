import MarkdownIt from 'markdown-it';
import {esc,slugify} from '../utils.js';

export function renderArticleMarkdown(source='',imageMetadata={}) {
  const md=new MarkdownIt({html:false,linkify:false,typographer:false,breaks:false});
  const headings=[];const ids=new Map();const usedIds=new Set();let previousLevel=1;
  const originalHeading=md.renderer.rules.heading_open||((tokens,index,options,env,self)=>self.renderToken(tokens,index,options));
  md.renderer.rules.heading_open=(tokens,index,options,env,self)=>{
    const token=tokens[index];const level=Math.min(Math.max(2,Number(token.tag.slice(1))),previousLevel+1);previousLevel=level;
    token.tag=`h${level}`;for(let i=index+1;i<tokens.length;i++)if(tokens[i].type==='heading_close'){tokens[i].tag=token.tag;break;}
    const inline=tokens[index+1];const text=(inline.children||[]).filter(child=>['text','code_inline','image'].includes(child.type)).map(child=>child.content).join('');
    const base=slugify(text)||`section-${headings.length+1}`;let count=(ids.get(base)||0)+1;let id=count>1?`${base}-${count}`:base;while(usedIds.has(id)){count++;id=`${base}-${count}`;}ids.set(base,count);usedIds.add(id);
    token.attrSet('id',id);headings.push({id,text,level:Number(token.tag.slice(1))});return originalHeading(tokens,index,options,env,self);
  };
  md.renderer.rules.fence=(tokens,index)=>{
    const token=tokens[index];const language=(token.info||'text').trim().split(/\s/)[0].replace(/[^a-z0-9_+-]/gi,'')||'text';
    return `<div class="code-block"><div class="code-caption"><span>${esc(language)}</span><button type="button" data-copy-code aria-label="Copy ${esc(language)} code" hidden>Copy code</button></div><pre tabindex="0" aria-label="${esc(language)} code example"><code class="language-${esc(language)}">${esc(token.content)}</code></pre></div>\n`;
  };
  const originalImage=md.renderer.rules.image;
  md.renderer.rules.image=(tokens,index,options,env,self)=>{
    const token=tokens[index];const image=imageMetadata[token.attrGet('src')];
    token.attrSet('loading','lazy');token.attrSet('decoding','async');token.attrSet('class','article-inline-image');
    if(image){token.attrSet('src',image.url);token.attrSet('width',String(image.width));token.attrSet('height',String(image.height));token.attrSet('srcset',image.srcset);token.attrSet('sizes','(max-width:840px) 92vw, 740px');}
    return originalImage(tokens,index,options,env,self);
  };
  const tokens=md.parse(String(source),{});const html=md.renderer.render(tokens,md.options,{});
  const plainText=tokens.map(token=>token.type==='inline'?(token.children||[]).map(child=>['text','code_inline','image'].includes(child.type)?child.content:['softbreak','hardbreak'].includes(child.type)?'\n':'').join(''):['fence','code_block'].includes(token.type)?token.content.trimEnd():'').filter(Boolean).join('\n\n');
  const toc=headings.filter(h=>h.level<=3);
  return {html,headings,plainText,toc:toc.length>=4?`<nav class="article-toc" aria-label="On this page"><h2>On this page</h2><ol>${toc.map(h=>`<li class="toc-level-${h.level}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('')}</ol></nav>`:''};
}
