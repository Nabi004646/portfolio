import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {shouldPlayIntro,introMarkup,introHead} from '../src/intro.js';
import {createPublicViews} from '../src/public-views.js';
import {defaultContent} from '../src/content.js';

test('intro is decorative, can be skipped, and never autoplays over articles or reduced/paused motion',()=>{
  assert.equal(shouldPlayIntro(),true);
  for(const settings of [{path:'/blog/article/'},{path:'/admin/',force:true},{reduced:true,force:true},{paused:true,force:true},{enabled:false,force:true},{played:true}])assert.equal(shouldPlayIntro(settings),false);
  assert.equal(shouldPlayIntro({played:true,force:true}),true);
  const markup=introMarkup({introTitle:'<script>bad()</script>'});
  assert.match(markup,/Skip intro/);assert.match(markup,/aria-hidden="true"/);assert.ok(!markup.includes('<script>'));
  assert.equal(introHead({canonical:'https://portfolio.test/blog/article/'}),'');
});

test('the first-paint guard always fails open if animation code does not load',async()=>{
  const source=await readFile('public/intro-boot.js','utf8');
  const classes=new Set();const root={dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
  let fallback;
  vm.runInNewContext(source,{document:{documentElement:root},location:{pathname:'/',search:''},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},URLSearchParams,setTimeout:(fn,delay)=>{assert.equal(delay,4000);fallback=fn;}});
  assert.ok(classes.has('intro-pending'));fallback();assert.ok(!classes.has('intro-pending'));assert.equal(root.dataset.introExpired,'true');
});

test('personal contacts render the exact supplied profiles in Contact and the footer',()=>{
  const views=createPublicViews({items:structuredClone(defaultContent)});const contact=views.contactPage();const footer=views.footer();
  assert.match(contact,/aria-label="Personal contact profiles"/);
  for(const url of ['https://www.facebook.com/nabie.webdev','https://github.com/Nabi004646']){
    assert.ok(contact.includes(`href="${url}"`));assert.ok(footer.includes(`href="${url}"`));
  }
  assert.match(footer,/data-replay-intro/);
});
