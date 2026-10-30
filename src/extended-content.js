export const extendedContent = [
  { id: 'certificates-settings', kind: 'settings', title: 'Certificate section & carousel', slug: '', is_published: true, sort_order: 6, data: {
    eyebrow: 'LEARNING, WITH A LITTLE PROOF', title: 'Milestones along\nthe way.',
    intro: 'Certificates from courses and workshops in my learning journey.',
    pageHeadline: 'Always learning.\nHere’s the journey.', allLabel: 'All certificates',
    viewLabel: 'View certificate', verifyLabel: 'View credential',
    previousLabel: 'Previous certificate', nextLabel: 'Next certificate', pauseLabel: 'Pause carousel', playLabel: 'Play carousel', closeLabel: 'Close certificate',
    autoplay: true, intervalSeconds: 5,
  } },
  { id: 'layout', kind: 'settings', title: 'Section layout & visibility', slug: '', is_published: true, sort_order: 7, data: {
    homeSections: [
      { section: 'hero', visible: true }, { section: 'ribbon', visible: true },
      { section: 'projects', visible: true }, { section: 'about', visible: true },
      { section: 'services', visible: true }, { section: 'skills', visible: true },
      { section: 'certificates', visible: true }, { section: 'blog', visible: true }, { section: 'contact', visible: true },
    ],
    showCertificatesOnAbout: true,
  } },
  { id: 'detail-copy', kind: 'settings', title: 'Buttons, captions & decorative copy', slug: '', is_published: true, sort_order: 8, data: {
    header: { cta: 'Let’s talk', themeLabel: 'Switch color theme', menuLabel: 'Open navigation' },
    footer: { privacy: 'Privacy', terms: 'Terms', studio: 'Studio', links: [] },
    home: { onlineLabel: 'Available online', yearLabel: 'PORTFOLIO', projectsLink: 'All projects', aboutLink: 'A little more about me', blogLink: 'All notes', servicesCaption: 'THINK. BUILD. IMPROVE.', monogram: 'NK', sticker: 'A CURIOUS\nHUMAN BEHIND\nTHE SCREEN. ↗', artCaption: 'BUILT IN NEPAL. OPEN TO THE WORLD.', featuredProjectsOnly: true, maxProjects: 2, maxArticles: 3 },
    heroArt: { fileName: 'hello_world.js', name: 'Nabin', building: 'what’s next', status: 'Always learning', securityTitle: 'Built with care', securityText: 'Security in mind.', floatingText: 'Make something good.', caption: 'AN EXPLORER’S WORK IN PROGRESS' },
    projectArt: { hostname: 'nepocore.com', brandFirst: 'nepo', brandSecond: 'core.', headline: 'Your everyday digital toolkit.', tools: ['Image tools', 'PDF tools', 'Dev tools'], search: 'Find your next useful tool', sticker: 'Made to be useful ✳', labLabel: 'Camera + location', studioLetter: 'N', studioCaption: 'IDEAS INTO\nINTERFACES.', studioNote: 'Let’s make\nit happen.' },
    articleArt: { curiosityCaption: 'STAY CURIOUS.', interfaceCaption: 'Good design feels simple. ↗', securityCaption: 'BUILD WITH CARE.' },
    projects: { allFilter: 'All projects', featuredFilter: 'Selected work', empty: 'More projects are on the way.', back: '← All projects', detailEyebrow: 'THE PROJECT', visit: 'Explore project', source: 'View source' },
    blog: { allFilter: 'All notes', search: 'Find a note…', empty: 'No notes match that search. Try another word.', back: '← All notes', sample: 'Sample article', sampleDetail: 'Sample article · editable in Studio', authorInitial: 'N', thanks: 'Thanks for reading.', conversation: 'Continue the conversation' },
    general: { backHome: '← Back home', detailsEyebrow: 'THE DETAILS', notFoundEyebrow: 'A LITTLE OFF THE PATH', notFoundTitle: 'This page isn’t here.', notFoundText: 'There’s still plenty to explore.', homeButton: 'Back to home', pauseMotion: 'Pause motion', motionPaused: 'Motion paused' },
  } },

];

// Deeply add new editor fields while preserving edited text, array order, and
// intentionally empty values. Content records deleted by the owner stay deleted.
export function mergeFields(defaults, actual) {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return actual === undefined ? structuredClone(defaults) : actual;
  const result = { ...structuredClone(defaults), ...(actual || {}) };
  for (const key of Object.keys(defaults)) if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) result[key] = mergeFields(defaults[key], actual?.[key]);
  return result;
}

export function mergeEditorFields(records, defaults) {
  return records.map(record => {
    const original = defaults.find(item => item.id === record.id);
    return original ? { ...record, data: mergeFields(original.data, record.data) } : record;
  });
}
