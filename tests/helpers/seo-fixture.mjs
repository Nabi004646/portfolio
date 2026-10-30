import {defaultContent} from '../../src/content.js';
import {ARTICLE_DEFAULTS,seoSettings} from '../../src/seo/model.js';

// Synthetic QA content only. Never included in the shipped site's published data.
export function seoFixture(count=8) {
  const items=structuredClone(defaultContent).filter(item=>item.kind!=='post'&&item.id!=='seo-settings');
  items.push({...structuredClone(seoSettings),data:{...seoSettings.data,archivePageSize:3,enableLlmsTxt:true}});
  const project=items.find(item=>item.kind==='project'&&item.is_published);
  for(let i=1;i<=count;i++)items.push({id:`fixture-${i}`,kind:'post',title:`Fixture Linux note ${i}`,slug:`fixture-note-${i}`,is_published:true,sort_order:i,
    first_published_at:'2025-02-01T10:00:00.000Z',content_modified_at:'2025-02-03T12:00:00.000Z',data:{...structuredClone(ARTICLE_DEFAULTS),
      seoTitle:`Fixture SEO title ${i}`,metaDescription:`A unique test description for fixture ${i}.`,excerpt:'A synthetic article used only to validate the renderer.',
      category:i===count?'Web development':'Linux',tags:['Fixture','Linux'],imageUrl:'/test-featured.png',imageAlt:'Synthetic blue terminal illustration',
      relatedProjectSlugs:project?[project.slug]:[],sources:[{label:'Official Linux documentation',url:'https://docs.kernel.org/'}],
      body:'# Test setup\n\nThis is a synthetic question and answer.\n\n## Reproduce it\n\n```sh\nprintf "<script>example</script>"\n```\n\n## Inspect the result\n\n![A synthetic result screenshot](/test-featured.png)\n\n## Check the source\n\nUse the [blog archive](/blog/).\n\n## Conclusion\n\nA fixture conclusion.',
    }});
  items.push({id:'private-draft',kind:'post',title:'DRAFT_SECRET_TITLE',slug:'private-draft',is_published:false,data:{body:'DRAFT_SECRET_BODY',metaDescription:'DRAFT_SECRET_DESCRIPTION',imageUrl:'https://blocked.invalid/draft.png'}});
  return {items,redirects:[{source_path:'/blog/old-fixture/',target_path:'/blog/fixture-note-1/',status:301},{source_path:'/blog/deleted-fixture/',target_path:null,status:410}]};
}
