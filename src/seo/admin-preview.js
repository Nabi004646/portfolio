import {esc,slugify} from '../utils.js';
import {ARTICLE_DEFAULTS} from './model.js';

export function seoPanel(record,origin) {
  return `<section class="seo-editor glass-panel"><div><span class="small-label">ARTICLE DISCOVERY</span><h2>Search preview estimate</h2><p>Google may choose a different title, description, or image. Lengths below are editing hints, not ranking rules.</p></div><div class="search-preview"><span class="search-preview-url" data-seo-url></span><strong data-seo-title></strong><p data-seo-description></p></div><div class="seo-lengths"><span data-seo-title-length></span><span data-seo-description-length></span></div><p data-slug-note class="seo-note"></p><div class="publication-dates"><span>First published: <strong>${esc(record.first_published_at||'Not published')}</strong></span><span>Content modified: <strong>${esc(record.content_modified_at||'Not published')}</strong></span></div><details class="editorial-guidance"><summary>Write for a real reader</summary><ul><li>Answer one specific reader question, with a direct answer near the start.</li><li>Use examples, screenshots, and reproducible steps you have actually checked.</li><li>Separate what you tried from what you learned in a reliable source.</li><li>Do not invent experience, credentials, ratings, or statistics.</li><li>Link relevant projects and sources; use descriptive headings and image alt text.</li><li>Keep the slug when changing a title. A changed published slug creates a permanent redirect after rebuilding.</li></ul></details><button class="small-button" type="button" data-preview-article>Preview article content</button><div data-article-editor-preview hidden></div></section>`;
}
export function updateSeoPreview(form,record,origin,previousSlug='') {
  const get=name=>form.elements.namedItem(name)?.value||'';
  const title=get('data.seoTitle')||get('title');const description=get('data.metaDescription')||get('data.excerpt');const slug=get('slug');
  const canonical=`${origin.replace(/\/$/,'')}/blog/${slug||'article-slug'}/`;
  form.querySelector('[data-seo-url]').textContent=canonical;
  form.querySelector('[data-seo-title]').textContent=title;
  form.querySelector('[data-seo-description]').textContent=description;
  form.querySelector('[data-seo-title-length]').textContent=`Title: ${title.length} characters`;
  form.querySelector('[data-seo-description-length]').textContent=`Description: ${description.length} characters`;
  form.querySelector('[data-slug-note]').textContent=record.first_published_at&&previousSlug&&previousSlug!==slug?`A 301 redirect will be generated from /blog/${previousSlug}/ to /blog/${slug}/ after a successful rebuild.`:'The article URL is independent of its title. Editing a saved title keeps the existing slug.';
}
export function publishingIssues(record) {
  if(record.kind!=='post'||!record.is_published)return [];
  const issues=[];const d={...ARTICLE_DEFAULTS,...record.data};
  if(d.sample)issues.push('Replace the sample content and turn Sample off before publishing.');
  if(!record.slug||record.slug!==slugify(record.slug,100)||['category','tag','page','search','feed'].includes(record.slug))issues.push('Choose a readable, non-reserved article slug.');
  if(!d.body?.trim())issues.push('Write the article content before publishing.');
  if(!d.metaDescription?.trim())issues.push('Add a unique meta description.');
  if(!d.imageUrl||!d.imageAlt?.trim())issues.push('Add a featured image and descriptive alt text.');
  if(d.socialImageUrl&&!d.socialImageAlt?.trim())issues.push('Add alt text for the social preview image.');
  return issues;
}
