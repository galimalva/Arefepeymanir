import { getClient, dbTable } from '../supabase.js';
import { setHtml, emptyNote, timelineHtml, awardHtml, RESUME_SECTIONS, FALLBACK_TIMELINE, FALLBACK_AWARDS } from '../about-data.js';

async function initResume() {
  let client = null;
  try {
    client = getClient();
  } catch (error) {
    client = null;
  }

  let timeline = [];
  let awards = [];
  if (client) {
    try {
      const results = await Promise.all([
        client.from(dbTable('timeline_items')).select('*').eq('is_published', true).order('sort_order', { ascending: true }),
        client.from(dbTable('awards')).select('*').eq('is_published', true).order('sort_order', { ascending: true })
      ]);
      timeline = results[0].data || [];
      awards = results[1].data || [];
    } catch (error) {
      /* خطا در دریافت داده — fallback کاملاً جایگزین می‌شود */
    }
  }

  const allTimeline = timeline.length ? timeline : FALLBACK_TIMELINE;
  for (const section of RESUME_SECTIONS) {
    const items = allTimeline.filter((item) => item.category === section.key);
    setHtml(section.id, items.length ? timelineHtml(items, section.key) : emptyNote());
  }

  setHtml('resume-awards', awards.length ? awardHtml(awards) : awardHtml(FALLBACK_AWARDS));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initResume);
}