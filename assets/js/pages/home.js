import { createArtworkCard } from '../ui.js';
import { escapeHtml, toPersianDigits, placeholderImage } from '../utils.js';
import { getClient, dbTable, publicUrl } from '../supabase.js';
import config from '../../../config.js';

const RANDOM_COUNT = 3;

const WORK_CATEGORIES = {
  short_story: 'داستان کوتاه',
  poem: 'شعر',
  essay: 'یادداشت/جستار',
  article: 'مقاله',
  memoir: 'خاطره',
  other: 'سایر'
};

const PLACEHOLDER_WORKS = [
  { id: 'w-1', title: 'داستان نمونه — جای‌نگهدار', category: 'short_story' },
  { id: 'w-2', title: 'شعر نمونه — جای‌نگهدار', category: 'poem' },
  { id: 'w-3', title: 'جستار نمونه — جای‌نگهدار', category: 'essay' }
];

const PLACEHOLDER_ARTWORKS = [
  { id: 'a-1', title: 'بوم نمونه — جای‌نگهدار', technique: 'نقاشی با رنگ روغن', year: 1401 },
  { id: 'a-2', title: 'مطالعهٔ رنگ — جای‌نگهدار', technique: 'نقاشی', year: 1402 },
  { id: 'a-3', title: 'بوم نمونه — جای‌نگهدار', technique: 'نقاشی', year: 1403 },
  { id: 'a-4', title: 'مطالعهٔ فرم — جای‌نگهدار', technique: 'نقاشی', year: 1403 }
];

let worksPool = [];
let artsPool = [];

const CACHE_KEYS = {
  literary_works: 'payman-home-works-cache',
  artworks: 'payman-home-arts-cache'
};

function readCache(table) {
  try {
    const raw = localStorage.getItem(CACHE_KEYS[table]);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(table, rows) {
  try {
    localStorage.setItem(CACHE_KEYS[table], JSON.stringify(rows.slice(0, 500)));
  } catch {
    /* storage full or unavailable */
  }
}

function renderInto(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function hideFeatured(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  const acc = el.closest ? el.closest('.acc') : null;
  if (acc) acc.style.display = 'none';
}

function showFeatured(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const acc = el.closest ? el.closest('.acc') : null;
  if (acc) acc.style.display = '';
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function loadPublished(client, table) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await withTimeout(
        client
          .from(dbTable(table))
          .select('*')
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
          .limit(500),
        6000
      );
      if (result.error) throw new Error(result.error.message || 'supabase error');
      return result.data || [];
    } catch {
      if (attempt === 3) return null;
    }
  }
  return null;
}

function pickRandom(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, RANDOM_COUNT);
}

function workCategory(work) {
  return WORK_CATEGORIES[work.category] || work.category || 'سایر';
}

function workImage(work) {
  if (work.image_url) return work.image_url;
  if (work.image) return publicUrl(work.image);
  return placeholderImage(work.title || 'اثر ادبی', { variant: 'lit', width: 480, height: 480 });
}

function createWorkCard(work) {
  const title = work.title || 'اثر ادبی';
  const link = `literary-work.html?id=${encodeURIComponent(work.id)}`;
  const category = workCategory(work);
  return `
    <article class="card work-card">
      <div class="card-media card-media--square">
        <a href="${link}" tabindex="-1" aria-hidden="true">
          <img src="${workImage(work)}" alt="تصویر: ${escapeHtml(title)}" loading="lazy">
        </a>
      </div>
      <div class="card-body">
        <p class="card-meta">
          <span class="badge">${escapeHtml(category)}</span>
        </p>
        <h3 class="card-title"><a href="${link}">${escapeHtml(title)}</a></h3>
      </div>
    </article>`;
}

function mapWorks(rows) {
  return (rows || []).map((w) => ({
    ...w,
    image_url: w.image ? publicUrl(w.image) : null
  }));
}

function mapArts(rows) {
  return (rows || []).map((a) => ({
    ...a,
    image_url: a.image ? publicUrl(a.image) : null
  }));
}

function renderRandomWorks() {
  if (worksPool.length) {
    showFeatured('featured-works');
    renderInto('featured-works', pickRandom(worksPool).map(createWorkCard).join(''));
  } else {
    hideFeatured('featured-works');
  }
}

function renderRandomArts() {
  if (artsPool.length) {
    showFeatured('featured-paintings');
    renderInto('featured-paintings', pickRandom(artsPool).map(createArtworkCard).join(''));
  } else {
    hideFeatured('featured-paintings');
  }
}

async function loadFeatured() {
  hideFeatured('featured-works');
  hideFeatured('featured-paintings');
  let client;
  try {
    client = getClient();
  } catch {
    worksPool = PLACEHOLDER_WORKS.slice();
    artsPool = PLACEHOLDER_ARTWORKS.slice();
    renderRandomWorks();
    renderRandomArts();
    return;
  }
  const [worksData, artsData] = await Promise.all([
    loadPublished(client, 'literary_works'),
    loadPublished(client, 'artworks')
  ]);
  if (worksData !== null) {
    worksPool = mapWorks(worksData);
    writeCache('literary_works', worksData);
  } else {
    worksPool = mapWorks(readCache('literary_works'));
  }
  if (artsData !== null) {
    artsPool = mapArts(artsData);
    writeCache('artworks', artsData);
  } else {
    artsPool = mapArts(readCache('artworks'));
  }
  renderRandomWorks();
  renderRandomArts();
}

function accHeadFor(containerId) {
  const container = document.getElementById(containerId);
  const acc = container && container.closest ? container.closest('.acc') : null;
  return acc ? acc.querySelector('.acc-head') : null;
}

function wireRandomOnClick() {
  const worksHead = accHeadFor('featured-works');
  const artsHead = accHeadFor('featured-paintings');
  if (worksHead) worksHead.addEventListener('click', renderRandomWorks);
  if (artsHead) artsHead.addEventListener('click', renderRandomArts);
}

function initHome() {
  const bio = config.author.bio || [];
  const facts = config.author.facts || [];
  renderInto(
    'home-bio',
    bio.map((p) => `<p class="bio-paragraph">${escapeHtml(p)}</p>`).join('')
  );
  renderInto(
    'home-facts',
    facts
      .map(
        (f) =>
          `<li class="fact-item"><span class="fact-label">${escapeHtml(f.label)}</span><span class="fact-value">${escapeHtml(toPersianDigits(f.value))}</span></li>`
      )
      .join('')
  );
  wireRandomOnClick();
  loadFeatured();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initHome);
}