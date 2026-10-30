import {defaultContent,getData,getRecord,byKind} from './content.js';
import {mediaUrl} from './local-media.js';
import {certificateSection,publicCertificates} from './certificates.js';
import {esc,lines,icon,safeUrl,markdown,formatDate} from './utils.js';
import {archiveView,articleView,blogCard} from './seo/blog-views.js';
import {publicPosts,seoSettings} from './seo/model.js';

export function createPublicViews({items,configured=false,offline=false,theme='light',motionPaused=false}) {
const site={...seoSettings.data,...getData(items,'seo-settings')};
const s = () => getData(items, 'settings');
const copy = section => (getData(items, 'ui-copy')[section] || getData(defaultContent, 'ui-copy')[section] || {});
const detail = section => getData(items, 'detail-copy')[section] || getData(defaultContent, 'detail-copy')[section] || {};
const certCopy = () => Object.keys(getData(items, 'certificates-settings')).length ? getData(items, 'certificates-settings') : getData(defaultContent, 'certificates-settings');
const layout = () => Object.keys(getData(items, 'layout')).length ? getData(items, 'layout') : getData(defaultContent, 'layout');
const cap = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;
const accentedLines = text => String(text).split('\n').map((part,index) => index ? `<span>${esc(part)}</span>` : esc(part)).join('<br>');
const externalAttrs = url => (url.startsWith('https:') || url.startsWith('blob:')) ? 'target="_blank" rel="noopener noreferrer"' : 'data-link';
const buttonLink = (text, href, style = 'primary', arrow = 'diagonal') => {
  const target = (arrow === 'download' ? mediaUrl(href) : safeUrl(href)) || '/contact';
  return `<a class="button button-${style}" href="${esc(target)}" ${externalAttrs(target)} ${arrow === 'download' ? 'download' : ''}>${esc(text)}${icon(arrow)}</a>`;
};
const eyebrow = text => `<div class="eyebrow"><span></span>${esc(text)}</div>`;

const visibleNav = () => s().nav || [];

function header(path) {
  return `<header class="site-header"><a class="brand" href="/" data-link>${esc(s().brand || 'Nabin')}<span>®</span></a>
    <nav class="desktop-nav" aria-label="Main navigation">${visibleNav().map(n => `<a data-link href="${esc(safeUrl(n.href) || '/')}" class="${path === n.href || n.href !== '/' && path.startsWith(n.href) ? 'active' : ''}" ${path === n.href ? 'aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}</nav>
    <div class="header-actions"><button class="icon-button theme-toggle" aria-label="${esc(detail('header').themeLabel)}">${icon(theme === 'dark' ? 'sun' : 'moon')}</button><a class="nav-contact" href="/contact" data-link>${esc(detail('header').cta)} ${icon('diagonal')}</a><button class="icon-button menu-toggle" aria-label="${esc(detail('header').menuLabel)}" aria-expanded="false">${icon('menu')}</button></div></header>
    <nav class="mobile-nav" aria-label="Mobile navigation" hidden>${visibleNav().map(n => `<a href="${esc(safeUrl(n.href) || '/')}" data-link>${esc(n.label)}${icon('diagonal')}</a>`).join('')}</nav>`;
}

function footer() {
  return `<footer class="site-footer"><div class="footer-top"><a class="brand" data-link href="/">${esc(s().brand)}<span>®</span></a><p>${esc(s().footerLine)}</p><div class="socials">${socialLinks()}</div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(s().name)}. ${esc(s().footerNote)}</span><div><a href="/privacy" data-link>${esc(detail('footer').privacy)}</a><a href="/terms" data-link>${esc(detail('footer').terms)}</a><a href="/admin" data-link>${esc(detail('footer').studio)} ${icon('diagonal')}</a>${s().demoEnabled?`<a href="/lab/" data-link>${icon('camera')}Camera & location lab</a>`:''}${s().introEnabled!==false?`<button class="intro-replay-button" type="button" data-replay-intro>${icon('spark')}${esc(s().introReplayLabel||'Replay intro')}</button>`:''}${(detail('footer').links || []).map(link => safeUrl(link.href) ? `<a href="${esc(safeUrl(link.href))}" ${externalAttrs(link.href)}>${esc(link.label)}</a>` : '').join('')}</div></div></footer>`;
}

function socialLinks() {
  const links = s().socialLinks || [['github', 'GitHub'], ['linkedin', 'LinkedIn']].map(([key,label]) => ({icon:key,label,url:s()[key]}));
  return links.map(link => safeUrl(link.url) ? `<a class="icon-button" href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(link.label)}">${icon(link.icon)}</a>` : '').join('');
}

function personalLinks() {
  const links=s().personalLinks||[{label:'Facebook',icon:'facebook',url:s().facebook},{label:'GitHub',icon:'github',url:s().github}];
  return `<nav class="personal-contact-links" aria-label="Personal contact profiles">${links.filter(link=>safeUrl(link.url)).map(link=>`<a class="personal-contact-card" href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer"><span class="personal-contact-icon">${icon(link.icon||'external')}</span><span><strong>${esc(link.label)}</strong><small>${esc(link.handle||link.label)}</small></span>${icon('diagonal')}</a>`).join('')}</nav>`;
}

function heroArt() {
  const ui = detail('heroArt');
  return `<div class="hero-art" aria-label="Abstract clay sculpture of a developer workspace">
    <div class="art-orbit orbit-one" data-parallax="0.045"></div><div class="art-orbit orbit-two"></div>
    <div class="clay-sphere sphere-blue" data-parallax="0.08"></div><div class="clay-sphere sphere-peach" data-parallax="-0.055"></div>
    <div class="code-window" data-parallax="-0.025"><div class="window-bar"><div><i></i><i></i><i></i></div><span>${esc(ui.fileName)}</span>${icon('code')}</div><div class="code-lines"><div><em>01</em><span class="code-pink">const</span> developer = {</div><div><em>02</em>&nbsp; name: <span class="code-yellow">'${esc(ui.name)}'</span>,</div><div><em>03</em>&nbsp; curious: <span class="code-pink">true</span>,</div><div><em>04</em>&nbsp; building: <span class="code-yellow">'${esc(ui.building)}'</span></div><div><em>05</em>};<span class="code-cursor"></span></div></div><div class="window-bottom"><span><i></i> ${esc(ui.status)}</span><span>↗</span></div></div>
    <div class="clay-bracket bracket-left" data-parallax="0.06">&lt;</div><div class="clay-bracket bracket-right" data-parallax="0.035">/&gt;</div>
    <div class="floating-label label-security" data-parallax="-0.04"><span class="label-icon">${icon('shield')}</span><div>${esc(ui.securityTitle)}<small>${esc(ui.securityText)}</small></div></div>
    <div class="floating-label label-create" data-parallax="0.065">${icon('spark')}<span>${esc(ui.floatingText)}</span></div>
    <div class="tiny-star star-one">✳</div><div class="tiny-star star-two">✧</div><span class="art-caption">${esc(ui.caption)}</span>
  </div>`;
}

function projectVisual(project) {
  const d = project.data; const ui = detail('projectArt');
  if (mediaUrl(d.imageUrl)) return `<img class="project-image" src="${esc(mediaUrl(d.imageUrl))}" alt="${esc(project.title)} project preview" loading="lazy">`;
  if (d.visual === 'tools') return `<div class="mini-browser"><div class="mini-toolbar"><span>•••</span><span>${esc(ui.hostname)}</span>${icon('lock')}</div><div class="mini-content"><div class="mini-brand">${esc(ui.brandFirst)}<span>${esc(ui.brandSecond)}</span></div><h4>${esc(ui.headline)}</h4><div class="mini-tools">${(ui.tools || []).map((tool,index) => `<div>${icon(['layers','file','code'][index%3])}${esc(tool)}</div>`).join('')}</div><div class="mini-search">${icon('search')}${esc(ui.search)} <span>↗</span></div></div></div><span class="visual-sticker">${esc(ui.sticker)}</span>`;
  if (d.visual === 'lab') return `<div class="lab-art"><div class="scan-face">${icon('camera')}</div><span class="lab-tag">${esc(ui.labLabel)}</span><div class="scan-corner corner-a"></div><div class="scan-corner corner-b"></div></div>`;
  return `<div class="studio-visual"><div class="studio-tile"><span>${esc(ui.studioLetter)}<span>®</span></span><small>${lines(ui.studioCaption)}</small></div><div class="studio-small"><span>${lines(ui.studioNote)}</span>${icon('diagonal')}</div><div class="studio-orb"></div></div>`;
}

function projectCard(project, index = 0) {
  const d = project.data;
  return `<a href="/projects/${esc(project.slug)}" data-link data-project-category="${esc(d.category)}" data-project-featured="${Boolean(d.featured)}" class="project-card reveal"><div class="project-visual visual-${esc(['blue', 'peach', 'lavender'].includes(d.color) ? d.color : 'blue')}"><span class="project-number">0${index + 1} /</span>${projectVisual(project)}<span class="round-link">${icon('diagonal')}</span></div><div class="project-meta"><div><span class="small-label">${esc(d.category)}</span><h3>${esc(project.title)}</h3></div>${icon('diagonal')}</div><p>${esc(d.summary)}</p><div class="tags">${(d.tags || []).map(tag => `<span>${esc(tag)}</span>`).join('')}</div></a>`;
}

function articleVisual(post) {
  if (mediaUrl(post.data.imageUrl)) return `<img src="${esc(mediaUrl(post.data.imageUrl))}" alt="" loading="lazy">`;
  const types = { curiosity: `<span class="blog-asterisk">✳</span><span class="small-orb"></span><span class="blog-art-caption">${esc(detail('articleArt').curiosityCaption)}</span>`, interfaces: `<div class="stacked-card card-back"></div><div class="stacked-card card-front"><span></span><i></i><i></i><b>${esc(detail('articleArt').interfaceCaption)}</b></div>`, security: `<div class="shield-orb">${icon('shield')}</div><span class="blog-art-caption">${esc(detail('articleArt').securityCaption)}</span>` };
  return types[post.data.visual] || types.curiosity;
}

function postCard(post) { return blogCard(post); }

function skillsSection() {
  if (!getRecord(items, 'skills')?.is_published) return '';
  const d = getData(items, 'skills');
  return `<section class="toolkit section"><div class="toolkit-intro reveal">${eyebrow(d.eyebrow)}<h2>${lines(d.title)}</h2><span class="clay-star">✳</span></div><div class="toolkit-groups">${(d.groups || []).map((g, i) => `<div class="toolkit-group reveal"><span class="small-label">0${i + 1} / ${esc(g.title)}</span><div>${g.items.map(item => `<span>${esc(item)}</span>`).join('')}</div></div>`).join('')}</div></section>`;
}

function ctaSection() {
  if (!getRecord(items, 'home')?.is_published) return '';
  const d = getData(items, 'home'); const ui = copy('cta');
  return `<section class="contact-cta section reveal"><div>${eyebrow(ui.eyebrow)}<h2>${lines(d.contactTitle)}</h2><p>${esc(d.contactText)}</p>${buttonLink(ui.button, '/contact', 'light')}</div><div class="cta-sculpture" aria-hidden="true"><span>✳</span><div></div><i></i></div><span class="cta-side">${esc(ui.sideNote)}</span></section>`;
}

function home() {
  const d = getData(items, 'home');
  const projects=byKind(items,'project').filter(p=>!p.data.sample&&(!detail('home').featuredProjectsOnly||p.data.featured));
  const posts=publicPosts(items);
  const sections = {
    hero: `<section class="hero section"><div class="hero-copy">${eyebrow(d.eyebrow)}<div class="hero-greeting"><span class="hello-wave">✳</span>${esc(d.greeting)}</div><h1>${esc(d.headline)}<br><span>${esc(d.accentLine)}</span></h1><p>${esc(d.intro)}</p><div class="hero-buttons">${buttonLink(d.primaryCta, '/projects')}${buttonLink(d.secondaryCta, '/contact', 'plain')}</div><div class="hero-location">${icon('pin')}<span>${esc(s().location)}</span><i></i><span>${esc(detail('home').onlineLabel)}</span></div></div>${heroArt()}<span class="hero-side">${esc(d.sideLabel)}</span></section><div class="hero-foot section"><a href="#selected-work" class="scroll-cue"><span>↓</span>${esc(d.scrollLabel)}</a><div class="availability"><i></i>${esc(s().availability)}</div><span class="hero-foot-year">${esc(detail('home').yearLabel)} / ${new Date().getFullYear()}</span></div>`,
    ribbon: `<div class="skill-ribbon" aria-label="Areas of interest"><div>${[...(d.chips || []), ...(d.chips || [])].map(chip => `<span>${esc(chip)}</span><i>✳</i>`).join('')}</div></div>`,
    projects: projects.length ? `<section class="section work-section" id="selected-work"><div class="section-heading reveal"><div>${eyebrow(d.workEyebrow)}<h2>${esc(d.workTitle)}</h2><p>${esc(d.workDescription)}</p></div><a class="text-link" href="/projects" data-link>${esc(detail('home').projectsLink)} ${icon('diagonal')}</a></div><div class="project-grid">${byKind(items, 'project').filter(p => !detail('home').featuredProjectsOnly || p.data.featured).slice(0, cap(detail('home').maxProjects, 2)).map(projectCard).join('')}</div></section>` : '',
    about: `<section class="about-strip section"><div class="about-art reveal"><div class="about-monogram">${esc(detail('home').monogram)}<span>✳</span></div><div class="about-sticker">${lines(detail('home').sticker)}</div><span class="about-art-label">${esc(detail('home').artCaption)}</span></div><div class="about-copy reveal">${eyebrow(d.aboutEyebrow)}<h2>${lines(d.aboutTitle)}</h2><p>${esc(d.aboutText)}</p><a class="text-link" data-link href="/about">${esc(detail('home').aboutLink)} ${icon('diagonal')}</a></div></section>`,
    services: `<section class="section services-section"><div class="section-heading reveal"><h2>${esc(d.serviceTitle)}</h2><span class="small-label">${esc(detail('home').servicesCaption)}</span></div><div class="services-grid">${(d.services || []).map((service, i) => `<article class="service-card reveal"><div class="service-icon service-icon-${i}">${icon(service.icon)}</div><span class="service-number">0${i + 1}</span><h3>${esc(service.title)}</h3><p>${esc(service.description)}</p></article>`).join('')}</div></section>`,
    skills: skillsSection(),
    certificates: certificateSection(byKind(items, 'certificate'), certCopy()),
    blog: `<section class="section articles-section"><div class="section-heading reveal"><div>${eyebrow(d.blogEyebrow)}<h2>${esc(d.blogTitle)}</h2></div><a class="text-link" data-link href="/blog">${esc(detail('home').blogLink)} ${icon('diagonal')}</a></div><div class="article-grid">${posts.slice(0, cap(detail('home').maxArticles, 3)).map(postCard).join('')}</div></section>`,
    contact: ctaSection(),
  };
  const seen = new Set();
  return (layout().homeSections || []).filter(row => row.visible && Object.hasOwn(sections,row.section) && !seen.has(row.section) && seen.add(row.section)).map(row => sections[row.section]).join('');
}

function aboutPage() {
  const d = getData(items, 'about'); const ui = copy('about');
  return `<section class="page-hero section"><div>${eyebrow(d.eyebrow)}<h1>${lines(d.headline)}</h1></div><p>${esc(d.intro)}</p></section><section class="section story-section"><div class="story-avatar">${mediaUrl(s().portraitUrl) ? `<img src="${esc(mediaUrl(s().portraitUrl))}" alt="${esc(s().name)}">` : `<div class="about-monogram">${esc(detail('home').monogram)}<span>✳</span></div>`}<span>${esc(s().name)}<small>${esc(s().location)}</small></span></div><div class="story-copy prose">${markdown(d.story)}${mediaUrl(s().resumeUrl) ? buttonLink(ui.resumeLabel, s().resumeUrl, 'primary', 'download') : ''}</div></section><section class="section principles-section"><div class="section-heading"><h2>${esc(ui.principlesHeading)}</h2></div><div class="services-grid">${(d.principles || []).map((p, i) => `<article class="service-card reveal"><span class="principle-number">0${i + 1}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></article>`).join('')}</div></section><section class="section journey-section"><div>${eyebrow(ui.journeyEyebrow)}<h2>${lines(ui.journeyHeading)}</h2></div><div class="timeline">${(d.journey || []).map(j => `<article class="timeline-item reveal"><span>${esc(j.label)}</span><h3>${esc(j.title)}</h3><p>${esc(j.description)}</p></article>`).join('')}</div></section>${skillsSection()}${layout().showCertificatesOnAbout ? certificateSection(byKind(items, 'certificate'), certCopy()) : ''}${ctaSection()}`;
}

function projectsPage() {
  const ui = copy('projects');
  return `<section class="page-hero section"><div>${eyebrow(ui.eyebrow)}<h1>${accentedLines(ui.headline)}</h1></div><p>${esc(ui.intro)}</p></section><section class="section listing-section"><div class="filter-bar" role="group" aria-label="Filter projects"><div class="filter-chips"><button class="filter-chip active" data-project-filter="all">${esc(detail('projects').allFilter)} <span>${byKind(items, 'project').length}</span></button><button class="filter-chip" data-project-filter="featured">${esc(detail('projects').featuredFilter)}</button>${[...new Set(byKind(items, 'project').map(project => project.data.category).filter(Boolean))].map(category => `<button class="filter-chip" data-project-filter="category:${esc(category)}">${esc(category)}</button>`).join('')}</div></div><div class="project-grid" id="project-results">${byKind(items, 'project').map(projectCard).join('')}</div></section>${ctaSection()}`;
}

function projectDetail(slug) {
  const project = byKind(items, 'project').find(p => p.slug === slug);
  if (!project) return notFound();
  const d = project.data;
  return `<section class="section detail-hero"><a class="back-link" href="/projects" data-link>${esc(detail('projects').back)}</a>${eyebrow(d.category)}<h1>${esc(project.title)}</h1><p>${esc(d.description)}</p><div class="tags">${(d.tags || []).map(tag => `<span>${esc(tag)}</span>`).join('')}</div></section><section class="section project-detail-visual"><div class="project-visual visual-${esc(d.color || 'blue')}">${projectVisual(project)}</div></section><section class="section detail-body"><div><span class="small-label">${esc(detail('projects').detailEyebrow)}</span><h2>${esc(d.summary)}</h2><span class="muted">${esc(d.year)}</span></div><div class="prose">${markdown(d.body)}<div class="hero-buttons">${safeUrl(d.url) ? buttonLink(detail('projects').visit, d.url) : ''}${safeUrl(d.github) ? buttonLink(detail('projects').source, d.github, 'outline', 'github') : ''}</div></div></section>${ctaSection()}`;
}

function blogPage() { return archiveView(items, site) || notFound(); }
function certificatesPage() { const ui=certCopy();return `<section class="page-hero section"><div>${eyebrow(ui.eyebrow)}<h1>${accentedLines(ui.pageHeadline)}</h1></div><p>${esc(ui.intro)}</p></section>${certificateSection(byKind(items,'certificate'),ui,{page:true})}${ctaSection()}`; }

function postDetail(slug) { const post=byKind(items,'post').find(item=>item.slug===slug&&!item.data.sample); return post ? articleView(post,items,site).html : notFound(); }

function contactPage() {
  const d = getData(items, 'contact'); const ui = copy('contact');
  return `<section class="page-hero section"><div>${eyebrow(d.eyebrow)}<h1>${lines(d.headline)}</h1></div><p>${esc(d.intro)}</p></section><section class="section contact-layout"><div class="contact-info"><a class="contact-email" href="mailto:${esc(s().email)}">${esc(s().email)}${icon('diagonal')}</a>${personalLinks()}<div class="contact-detail">${icon('pin')}<span>${esc(ui.locationLabel)}<small>${esc(s().location)}</small></span></div><div class="contact-detail">${icon('clock')}<span>${esc(ui.availabilityLabel)}<small>${esc(s().availability)}</small></span></div><div class="socials">${socialLinks()}</div><div class="contact-clay">✳<span>${lines(ui.decoration)}</span></div></div><form class="contact-form glass-panel" id="contact-form" method="post"><div class="form-heading"><h2>${esc(d.formTitle)}</h2><span>↗</span></div><div class="form-row"><label>${esc(ui.nameLabel)}<input name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="${esc(ui.namePlaceholder)}"></label><label>${esc(ui.emailLabel)}<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label></div><label>${esc(ui.subjectLabel)}<select name="subject">${(ui.subjects || []).map(subject => `<option>${esc(subject)}</option>`).join('')}</select></label><label>${esc(ui.messageLabel)}<textarea name="message" required minlength="10" maxlength="5000" rows="5" placeholder="${esc(ui.messagePlaceholder)}"></textarea></label><label class="attachment-zone" id="attachment-zone">${icon('upload')}<span><strong id="attachment-name">${esc(ui.attachmentLabel)}</strong><small>${esc(d.attachmentHelp)}</small></span><input type="file" name="attachment" accept=".pdf,.jpg,.jpeg,.png,.webp" aria-label="Attach a file"></label><button class="text-link attachment-remove" type="button" hidden>Remove attachment ×</button><label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label class="consent-check"><input type="checkbox" name="consent" required><span>I agree to send this message and any attachment to ${esc(s().name)}. <a href="/privacy" data-link>Privacy details</a></span></label><div id="contact-turnstile"></div><p class="form-error" id="contact-error" role="alert"></p><button class="button button-primary submit-button" type="submit">${esc(d.submitLabel)}${icon('diagonal')}</button><p class="form-footnote">${icon('lock')}${esc(ui.footnote)}</p></form></section><section class="section faq-section"><div>${eyebrow(ui.faqEyebrow)}<h2>${esc(ui.faqTitle)}</h2></div><div>${(d.faqs || []).map(faq => `<details><summary>${esc(faq.question)}<span>+</span></summary><p>${esc(faq.answer)}</p></details>`).join('')}</div></section>`;
}

function textPage(slug) {
  const page = byKind(items, 'page').find(p => p.slug === slug);
  if (!page) return notFound();
  return `<section class="section text-page"><a href="/" data-link class="back-link">${esc(detail('general').backHome)}</a>${eyebrow(detail('general').detailsEyebrow)}<h1>${esc(page.title)}</h1><p class="post-excerpt">${esc(page.data.intro)}</p><div class="prose">${markdown(page.data.body)}</div></section>`;
}

function labPage() {
  const ui = copy('lab');
  return `<section class="section lab-page"><div>${eyebrow(ui.eyebrow)}<h1>${accentedLines(ui.headline)}</h1><p>${esc(ui.intro)}</p><button class="button button-primary" id="start-lab">${esc(ui.button)} ${icon('camera')}</button><a class="text-link" data-link href="/privacy">How your data is used ${icon('diagonal')}</a>${!configured ? '<p class="local-warning">Local preview: submissions are disabled until your Supabase backend and email service are configured. Try the simulated walkthrough, or explicitly start a device-only camera/location test. Nothing is emailed in preview mode.</p>' : ''}</div><div class="lab-illustration">${icon('camera')}<span>${lines(ui.illustration)}</span><i>✳</i></div></section>`;
}

function notFound() { return `<section class="section not-found">${eyebrow(detail('general').notFoundEyebrow)}<h1>404<span>✳</span></h1><h2>${esc(detail('general').notFoundTitle)}</h2><p>${esc(detail('general').notFoundText)}</p>${buttonLink(detail('general').homeButton, '/')}</section>`; }


return {header,footer,home,aboutPage,projectsPage,projectDetail,blogPage,postDetail,contactPage,labPage,notFound,textPage,postCard,projectCard,ctaSection,certificatesPage};
}
