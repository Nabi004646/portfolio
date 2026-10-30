import { seoSettings, ARTICLE_DEFAULTS } from './seo/model.js';
import { extraCopy } from './extra-copy.js';
import { extendedContent } from './extended-content.js';
// Initial copy is editable in Studio. Sample articles are explicitly labeled.
export const defaultContent = [
  extraCopy,
  seoSettings,
  ...extendedContent,
  { id: 'settings', kind: 'settings', title: 'Site settings', slug: '', is_published: true, sort_order: 0, data: {
    name: 'Nabin Kunwar', brand: 'Nabin', role: 'Developer & security explorer',
    location: 'Kathmandu, Nepal', email: 'nabinkunwar992@gmail.com',
    github: 'https://github.com/Nabi004646',
    facebook: 'https://www.facebook.com/nabie.webdev',
    linkedin: 'https://www.linkedin.com/in/nabin-kunwar-332551356/',
    Whatsapp: '+9779828426029',
    socialLinks: [
      { label: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/nabie.webdev' },
      { label: 'GitHub', icon: 'github', url: 'https://github.com/Nabi004646' },
      { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/nabin-kunwar-332551356/' },
      { label: 'Whatsapp', icon: 'external', url: '+9779828426029' },
    ],
    personalLinks: [
      { label: 'Facebook', handle: '@nabie.webdev', icon: 'facebook', url: 'https://www.facebook.com/nabie.webdev' },
      { label: 'GitHub', handle: '@Nabi004646', icon: 'github', url: 'https://github.com/Nabi004646' },
    ],
    introEnabled: true, introTitle: 'NABI', introCaption: 'Curiosity. Craft. A little fire.', introReplayLabel: 'Replay intro',
    resumeUrl: '', portraitUrl: '', availability: 'Open to ideas & collaborations',
    footerLine: 'A little curiosity. A lot of care.', footerNote: 'Designed with intention. Built in Nepal.',
    metaDescription: 'Nabin Kunwar — web developer and cybersecurity student. Projects, experiments, and notes from Nepal.',
    cream: '#f5f3ee', blue: '#3156eb', coral: '#ff916c',
    entranceRequired: false, demoEnabled: true, demoRecipientLabel: 'Nabin Kunwar (portfolio owner)',
    nav: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }, { label: 'Projects', href: '/projects' }, { label: 'Certificates', href: '/certificates' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }],
  } },
  { id: 'home', kind: 'home', title: 'Home', slug: '', is_published: true, sort_order: 1, data: {
    eyebrow: 'DEVELOPER. LEARNER. BUILDER.', greeting: 'Hey, I’m Nabin',
    headline: 'I build for the web.', accentLine: 'And think beyond it.',
    intro: 'A web developer and cybersecurity student turning curiosity into thoughtful digital experiences. Based in Nepal. Building for everywhere.',
    primaryCta: 'Explore my work', secondaryCta: 'Let’s talk',
    sideLabel: 'IDEAS INTO INTERFACES', scrollLabel: 'A little more about me',
    workEyebrow: 'SELECTED WORK', workTitle: 'Built with curiosity.', workDescription: 'A few projects where ideas become something you can actually use.',
    aboutEyebrow: 'THE PERSON BEHIND THE PIXELS', aboutTitle: 'Curious by nature.\nA builder by choice.',
    aboutText: 'I’m Nabin, or Nabi for short. I enjoy connecting design and development, then asking how to make what I build safer. My interests stretch from cybersecurity to robotics, neuroscience, and biology.',
    blogEyebrow: 'NOTES FROM THE JOURNEY', blogTitle: 'Learning out loud.',
    contactTitle: 'Have something\nin mind?', contactText: 'An idea, a question, or just a hello. My inbox is a good place to start.',
    chips: ['Web development', 'Cybersecurity', 'Always curious'],
    serviceTitle: 'What I bring to the table.',
    services: [
      { icon: 'code', title: 'Thoughtful development', description: 'Responsive websites and interfaces built around the people who use them.' },
      { icon: 'layers', title: 'Design that feels right', description: 'Clear layouts, small details, and interactions that make the web a little nicer.' },
      { icon: 'shield', title: 'A security mindset', description: 'Learning how systems work, how they fail, and how to build with more care.' },
    ],
  } },
  { id: 'about', kind: 'about', title: 'About me', slug: 'about', is_published: true, sort_order: 2, data: {
    eyebrow: 'A LITTLE ABOUT ME', headline: 'More than a\nline of code.',
    intro: 'I’m Nabin Kunwar, a web developer and cybersecurity student from Nepal. I like making useful things and understanding what happens beneath the surface.',
    story: 'I started with the building blocks of the web: HTML, CSS, and JavaScript. That grew into an interest in full-stack development, WordPress, and the details that turn a page into an experience.\n\nNow I’m also learning cybersecurity. For me, building and understanding security belong together. I use Linux, keep experimenting, and learn best by making something real.\n\nOutside the browser, I’m curious about neuroscience, robotics, and biology. Android development is also on my learning horizon.',
    principles: [
      { title: 'Keep asking why.', description: 'The interesting part usually starts one question deeper.' },
      { title: 'Make it useful.', description: 'Good work makes someone’s day a little easier.' },
      { title: 'Build with care.', description: 'Accessibility, privacy, and the small details all count.' },
    ],
    journey: [
      { label: 'Building foundations', title: 'Web development', description: 'HTML, CSS, JavaScript, and responsive interfaces.' },
      { label: 'Making things real', title: 'Personal projects', description: 'Exploring WordPress, full-stack workflows, and Nepocore.' },
      { label: 'Learning now', title: 'Cybersecurity', description: 'Linux, web security fundamentals, and hands-on practice.' },
      { label: 'On the horizon', title: 'Android development', description: 'An interest in Kotlin, mobile experiences, and what comes next.' },
    ],
  } },
  { id: 'skills', kind: 'skills', title: 'Skills & toolkit', slug: '', is_published: true, sort_order: 3, data: {
    eyebrow: 'MY EVERYDAY TOOLKIT', title: 'Different tools.\nOne curious mind.',
    groups: [
      { title: 'Web & interfaces', items: ['HTML', 'CSS', 'JavaScript', 'React', 'Responsive design'] },
      { title: 'Building & shipping', items: ['Node.js', 'MySQL', 'WordPress', 'Git', 'Cloudflare'] },
      { title: 'Exploring next', items: ['Cybersecurity', 'Linux', 'Supabase', 'Kotlin', 'Android'] },
    ],
  } },
  { id: 'contact', kind: 'contact', title: 'Contact', slug: 'contact', is_published: true, sort_order: 4, data: {
    eyebrow: 'LET’S MAKE SOMETHING', headline: 'Good things start\nwith a hello.',
    intro: 'Tell me what you have in mind. A project, a collaboration, or a question — I’d like to hear it.',
    formTitle: 'A note to Nabin', submitLabel: 'Send your message',
    attachmentHelp: 'A brief or a reference? Attach a PDF, JPG, PNG, or WebP. Up to 5 MB.',
    successTitle: 'Your note is in.', successText: 'Thanks for reaching out. I’ll read your message and get back to you.',
    faqs: [
      { question: 'What can I contact you about?', answer: 'Web projects, collaborations, learning opportunities, or a thoughtful question. Share enough context to help me understand your idea.' },
      { question: 'Can I include a project brief?', answer: 'Yes. Add a PDF or an image to the contact form. Attachments are private and available only to the portfolio administrator.' },
      { question: 'Where are you based?', answer: 'I’m based in Nepal and happy to connect online.' },
    ],
  } },
  { id: 'project:nepocore', kind: 'project', title: 'Nepocore', slug: 'nepocore', is_published: true, sort_order: 10, data: {
    category: 'WEB DEVELOPMENT', summary: 'Useful tools. One simple place.', description: 'My personal project exploring a home for free online tools and downloadable resources.',
    body: 'Nepocore is a personal web project built around useful digital tools. The aim is a clear interface where people can find a tool and get on with their task.\n\nWorking on it has been a way to practice responsive layouts, deployment, and improving the details of a real site.',
    tags: ['Web tools', 'Responsive UI', 'Personal project'], url: 'https://nepocore.com', github: '', imageUrl: '', visual: 'tools', color: 'blue', year: 'Personal project', featured: true,
  } },
  { id: 'project:portfolio-studio', kind: 'project', title: 'Portfolio Studio', slug: 'portfolio-studio', is_published: true, sort_order: 11, data: {
    category: 'DESIGN & DEVELOPMENT', summary: 'A space that feels like me.', description: 'This portfolio brings soft clay forms, glass surfaces, and subtle parallax together with an editable content studio.',
    body: 'A personal home for my work, interests, and learning notes. This project uses a static frontend designed for Cloudflare Pages and a Supabase backend for content, files, and administrator authentication.\n\nThe interface explores depth through clay-inspired shapes and glass, with reduced-motion support and layouts for small screens.',
    tags: ['Supabase', 'Cloudflare Pages', 'Content studio'], url: '', github: '', imageUrl: '', visual: 'studio', color: 'peach', year: 'Portfolio project', featured: true,
  } },
  { id: 'project:consent-lab', kind: 'project', title: 'Camera & Location Lab', slug: 'consent-lab', is_published: true, sort_order: 12, data: {
    category: 'INTERACTIVE EXPERIMENT', summary: 'An experiment in browser APIs.', description: 'A disclosed camera and location demo with local face detection, a visible countdown, and consent before capture.',
    body: 'A college-project experiment with browser camera access, local face detection, and geolocation. Participants first see what will be collected and where it will be sent.\n\nAfter consent and browser permissions, face detection starts a visible countdown. The full camera frame and location can be submitted through a Supabase Edge Function. This is a demonstration of browser APIs, not a proof of identity or a CAPTCHA.',
    tags: ['Browser APIs', 'MediaPipe', 'Consent'], url: '/lab', github: '', imageUrl: '', visual: 'lab', color: 'lavender', year: 'College experiment', featured: false,
  } },
  { id: 'post:building-with-curiosity', kind: 'post', title: 'Building with curiosity, one project at a time', slug: 'building-with-curiosity', is_published: true, sort_order: 20, data: {
    category: 'PERSONAL NOTES', excerpt: 'Why small projects are my favorite way to connect the dots between an idea and something useful.',
    body: 'The quickest way I know to discover what I don’t understand is to start building. A small project gives every new concept a place to live.\n\n## Start with one useful thing\nA project doesn’t need to do everything. A clear problem, a simple first version, and a little room for improvement are enough to get moving.\n\n## Follow the questions\nWhen a layout breaks or a request fails, the interesting lesson is often below the symptom. Reading the error, checking an assumption, and trying again are part of the work.\n\n## Leave it a little better\nSmall improvements add up: clearer copy, a better focus state, a smaller download. Making something useful is a process of paying attention.',
    date: '2026-10-30', readTime: '3 min read', tags: ['Learning', 'Projects'], imageUrl: '', visual: 'curiosity', sample: true,
  } },
  { id: 'post:building-for-people', kind: 'post', title: 'The small details that make a website feel better', slug: 'building-for-people', is_published: true, sort_order: 21, data: {
    category: 'WEB DEVELOPMENT', excerpt: 'Clear feedback, readable type, and a button that does exactly what it promises.',
    body: 'A good interface helps people know where they are, what just happened, and what they can do next.\n\n## Make feedback visible\nIf someone uploads a file, show its name. If a form fails, explain what they can fix. If a task is still running, show that work is in progress.\n\n## Give the content room\nReadable text and a calm layout make a site easier to use. Animation should support the content, and a reduced-motion preference should be respected.\n\n## Be clear about the next step\nA specific button label is a small kindness. It helps people understand what will happen before they act.',
    date: '2026-10-30', readTime: '4 min read', tags: ['Interfaces', 'Accessibility'], imageUrl: '', visual: 'interfaces', sample: true,
  } },
  { id: 'post:camera-demo', kind: 'post', title: 'A browser experiment: camera, location, and consent', slug: 'camera-location-consent', is_published: true, sort_order: 22, data: {
    category: 'PROJECT NOTES', excerpt: 'What this portfolio’s interactive demo does, and why the explanation comes before the capture.',
    body: 'This portfolio includes a camera-and-location experiment. It’s a way to explore browser APIs and a complete frontend-to-backend flow.\n\n## Explain the action first\nBefore starting, the demo explains that it captures a photo and location and emails them to the project owner. Browser permission prompts are an additional step, not a replacement for that explanation.\n\n## Keep the camera visible\nThe preview shows what the camera sees. Face detection runs locally and starts a visible countdown before capture. Camera tracks stop after the frame is captured or the participant cancels.\n\n## Handle the result honestly\nA failed submission should remain a failed submission. The real flow advances only after the backend accepts the message through the email service. Email-service acceptance is not proof of arrival in an inbox.',
    date: '2026-10-30', readTime: '4 min read', tags: ['Browser APIs', 'Project'], imageUrl: '', visual: 'security', sample: true,
  } },
  { id: 'page:privacy', kind: 'page', title: 'Privacy & data', slug: 'privacy', is_published: true, sort_order: 30, data: {
    intro: 'A plain-language explanation of the information used by this project.',
    body: '## Contact form\nIf you send a message, your name, email, message, and optional attachment are stored privately in Supabase so the portfolio owner can reply. An email notification may also be sent to the owner. Do not attach sensitive documents.\n\n## Camera and location Lab\nThe optional Lab starts only after an explicit action and disclosure. A simulated walkthrough uses no device data. In device-only mode, camera and location permissions are requested, one They are not uploaded or emailed; closing the test discards the preview.\n\n## Connected submissions\nOnce the backend is configured, The owner can delete records and stored files in the admin studio. Emailed copies must be deleted separately from the owner’s mailbox. Ask the owner to delete your submission using its reference ID.\n\n## Local storage\nNon-sensitive local preview content may be stored in this browser. A session-only marker remembers a successful demo submission for this tab. Administrator sign-in uses session storage. No analytics or advertising trackers are included.\n\n## Third-party services\nThe configured site uses Supabase for data and authentication, an email provider for delivery, and optionally Cloudflare Turnstile for spam prevention. Fonts are self-hosted; loading a page does not contact Google Fonts.\n\n## Questions\nContact the email shown on the Contact page to ask about your information. This college-project notice should be reviewed and updated before any public launch.',
  } },
  { id: 'page:terms', kind: 'page', title: 'Project terms', slug: 'terms', is_published: true, sort_order: 31, data: {
    intro: 'An personal portfolio and a place to share my work.',
    body: '## About this project\nThis website is a personal portfolio and educational project. Project examples and learning notes describe work in progress. Sample articles are marked and can be replaced in the admin studio.\n\n## . This experiment is not a security control, age check, or proof of identity. A static-site gate is a presentation flow and cannot protect public frontend assets.\n\n## Respectful use\nPlease do not submit unlawful content, private information belonging to someone else, or malicious files. Contact attachments are restricted to supported images and PDF files.\n\n## Availability\nFeatures depend on browser support and configured services. If you need help or want a submission removed, contact the portfolio owner and include the submission reference if available.',
  } },
];

for (const record of defaultContent) if (record.kind === 'post') { record.data = {...structuredClone(ARTICLE_DEFAULTS), ...record.data}; if(record.data.sample) record.is_published=false; }

export const baseKinds = ['settings', 'home', 'about', 'skills', 'contact'];
export const getRecord = (items, id) => items.find(item => item.id === id);
export const getData = (items, id) => getRecord(items, id)?.data ?? {};
export const byKind = (items, kind) => items.filter(item => item.kind === kind && item.is_published).sort((a, b) => a.sort_order - b.sort_order);
