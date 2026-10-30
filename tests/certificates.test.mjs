import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultContent, byKind, getData } from '../src/content.js';
import { mergeEditorFields } from '../src/extended-content.js';
import { certificateCard, certificateSection, relativeSlide } from '../src/certificates.js';
import { mediaUrl } from '../src/local-media.js';

test('editor upgrades preserve owner copy, custom order, empty arrays, and deleted content', () => {
  const original=structuredClone(defaultContent);
  original.find(item=>item.id==='home').data.greeting='My own greeting';
  original.find(item=>item.id==='layout').data.homeSections=[{section:'certificates',visible:true},{section:'hero',visible:false}];
  original.find(item=>item.id==='about').data.principles=[];
  const deleted=original.filter(item=>item.id!=='certificate:preview-1');
  const upgraded=mergeEditorFields(deleted,defaultContent);
  assert.equal(getData(upgraded,'home').greeting,'My own greeting');
  assert.deepEqual(getData(upgraded,'layout').homeSections,[{section:'certificates',visible:true},{section:'hero',visible:false}]);
  assert.deepEqual(getData(upgraded,'about').principles,[]);
  assert.equal(upgraded.some(item=>item.id==='certificate:preview-1'),false);
});
const certificate = {id:'certificate:real',kind:'certificate',title:'Course completion',is_published:true,data:{imageUrl:'https://example.com/certificate.png',issuer:'Course provider',skills:[]}};
test('sample, missing-image and unpublished certificates never reach public cards or lightbox controls', () => {
  const ui=getData(defaultContent,'certificates-settings');
  for(const record of [{...certificate,data:{...certificate.data,sample:true}},{...certificate,data:{...certificate.data,imageUrl:''}},{...certificate,is_published:false},{...certificate,data:{...certificate.data,imageUrl:'javascript:alert(1)'}}]) {
    assert.equal(certificateCard(record,ui),'');
    assert.doesNotMatch(certificateSection([record],ui),/data-certificate-open=|data-certificate-carousel/);
  }
  const html=certificateCard({...certificate,title:'<script>alert(1)</script>',data:{...certificate.data,issuer:'<img src=x onerror=alert(1)>'}},ui);
  assert.ok(!html.includes('<script>')&&!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(mediaUrl('blob:unregistered'),'');
  assert.equal(mediaUrl('local-media:missing'),'');
});
test('certificate section remains visible without samples and published images retain carousel controls', () => {
  const ui=getData(defaultContent,'certificates-settings');
  assert.match(certificateSection([],ui),/id="certificates"/);
  assert.doesNotMatch(certificateSection([],ui),/image goes here|replace|upload|data-certificate-open=/i);
  assert.equal(byKind(defaultContent,'certificate').length,0);
  const one=certificateSection([certificate],ui);
  assert.match(one,/aria-roledescription="carousel"/);
  assert.match(one,/Previous certificate/);
  assert.match(one,/Pause carousel/);
  assert.match(one,/View certificate/);
});
test('carousel wrapping keeps a single active slide and immediate neighbors through every rotation', () => {
  for (const length of [1,2,3,5,10]) for(let active=0;active<length;active++) {
    const relative=Array.from({length},(_,index)=>relativeSlide(index,active,length));
    assert.equal(relative.filter(offset=>offset===0).length,1);
    assert.equal(relative[active],0);
    if(length>2) {assert.ok(relative.includes(-1));assert.ok(relative.includes(1));}
  }
});
