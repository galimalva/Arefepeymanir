import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits } from '../utils.js';
import config from '../../../config.js';
import { setHtml, emptyNote, timelineHtml, awardHtml, CATEGORY_SECTIONS, FALLBACK_TIMELINE, FALLBACK_AWARDS } from '../about-data.js';

const FALLBACK_PHOTO = 'assets/images/1001.jpg';

const FALLBACK_PROFILE = {
  full_name: config.author.fullName,
  title_role: config.author.role,
  birth_year: 1337,
  birth_place: 'مشهد',
  education: 'کارشناس مدیریت؛ کارشناس ارشد هنر اسلامی (دانشگاه فردوسی مشهد)'
};

function profileHtml(profile) {
  const photo = profile.photo_url ? publicUrl(profile.photo_url) : FALLBACK_PHOTO;
  const facts = [];
  if (profile.birth_year || profile.birth_place) {
    facts.push(`متولد: ${[toPersianDigits(profile.birth_year), profile.birth_place].filter(Boolean).join('، ')}`);
  }
  if (profile.education) facts.push(`تحصیلات: ${profile.education}`);
  if (profile.email || profile.phone) {
    facts.push([profile.email, toPersianDigits(profile.phone)].filter(Boolean).join(' — '));
  }
  const name = profile.full_name || 'نام هنرمند — در انتظار اطلاعات';
  return `
    <div class="about-head">
      <img class="about-photo" src="${photo}" alt="عکس معصومه (عارفه) پیمان" loading="lazy">
      <div class="about-info">
        <h1 class="display-2">${escapeHtml(name)}</h1>
        ${profile.title_role ? `<p class="lead">${escapeHtml(profile.title_role)}</p>` : ''}
        ${facts.length ? `<ul class="about-meta">${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;
}

function bioHtml(profile) {
  const bio = profile && (profile.bio_full || profile.bio_short);
  const paragraphs = bio
    ? String(bio).split(/\n+/).filter(Boolean)
    : config.author.bio.filter(Boolean);
  return paragraphs.map((p) => `<p class="bio-paragraph">${escapeHtml(p)}</p>`).join('');
}

function socialsHtml(items) {
  if (!items.length) return emptyNote();
  return (
    '<div class="socials-row">' +
    items
      .map(
        (link) =>
          `<a class="social-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.platform)}</a>`
      )
      .join('') +
    '</div>'
  );
}

async function initAbout() {
  let client = null;
  try {
    client = getClient();
  } catch (error) {
    client = null;
  }

  let profile = null;
  let timeline = [];
  let awards = [];
  let socials = [];
  if (client) {
    try {
      const results = await Promise.all([
        client.from(dbTable('author_profile')).select('*').maybeSingle(),
        client.from(dbTable('timeline_items')).select('*').eq('is_published', true).order('sort_order', { ascending: true }),
        client.from(dbTable('awards')).select('*').eq('is_published', true).order('sort_order', { ascending: true }),
        client.from(dbTable('social_links')).select('*').order('sort_order', { ascending: true })
      ]);
      profile = results[0].data || null;
      timeline = results[1].data || [];
      awards = results[2].data || [];
      socials = results[3].data || [];
    } catch (error) {
      /* خطا در دریافت داده — fallback کاملاً جایگزین می‌شود */
    }
  }

  setHtml('about-head', profileHtml(profile || FALLBACK_PROFILE));
  setHtml('about-bio', bioHtml(profile));

  const allTimeline = timeline.length ? timeline : FALLBACK_TIMELINE;
  for (const section of CATEGORY_SECTIONS) {
    const items = allTimeline.filter((item) => item.category === section.key);
    setHtml(section.id, items.length ? timelineHtml(items, section.key) : emptyNote());
  }

  setHtml('awards-container', awards.length ? awardHtml(awards) : awardHtml(FALLBACK_AWARDS));
  setHtml('socials-container', socialsHtml(socials));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initAbout);
}