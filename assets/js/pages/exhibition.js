import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, placeholderImage, setSeo } from '../utils.js';

const TYPE_LABELS = {
  solo: 'انفرادی',
  group: 'گروهی',
  joint: 'مشترک',
  online: 'آنلاین',
  other: 'سایر'
};

const ART_CATEGORY_LABELS = {
  abstract: 'انتزاعی',
  calligraphy: 'خوشنویسی',
  traditional: 'سنتی',
  portrait: 'چهره',
  landscape: 'منظره',
  still_life: 'طبیعت بی‌جان',
  figurative: 'تجسمی',
  floral: 'گل و گیاه',
  other: 'سایر'
};

function imageOf(exhibition) {
  if (exhibition.image) return publicUrl(exhibition.image);
  if (exhibition.image_url) return exhibition.image_url;
  return placeholderImage(exhibition.title || 'نمایشگاه', { variant: 'art', width: 1200, height: 720 });
}

function artImageOf(art) {
  if (art.image) return publicUrl(art.image);
  if (art.image_url) return art.image_url;
  return placeholderImage(art.title || 'اثر', { variant: 'art', width: 800, height: 1000 });
}

function detailHtml(exhibition) {
  const typeLabel = TYPE_LABELS[exhibition.type] || exhibition.type || '';
  const meta = [];
  if (exhibition.year) meta.push(['سال', toPersianDigits(exhibition.year)]);
  if (exhibition.location || exhibition.country) meta.push(['مکان', [exhibition.location, exhibition.country].filter(Boolean).join('، ')]);
  if (exhibition.organizer) meta.push(['برگزارکننده', exhibition.organizer]);
  const paragraphs = exhibition.description
    ? String(exhibition.description).split(/\n+/).filter(Boolean)
    : [];
  const thumbs = [exhibition.image, ...(Array.isArray(exhibition.images) ? exhibition.images : [])]
    .filter(Boolean)
    .map((path, i) => {
      const src = publicUrl(path);
      return `<button class="work-thumb${i === 0 ? ' is-active' : ''}" type="button" data-src="${escapeHtml(src)}" aria-label="نمایش تصویر ${toPersianDigits(i + 1)}"><img src="${escapeHtml(src)}" alt="" loading="lazy"></button>`;
    });
  return `
    <div class="exhibition-detail-inner">
      <figure class="exhibition-media">
        <img id="exMain" class="work-main-img" src="${imageOf(exhibition)}" alt="نمایشگاه: ${escapeHtml(exhibition.title || 'بدون عنوان')}" fetchpriority="high">
        ${thumbs.length > 1 ? `<div class="work-thumbs" aria-label="تصاویر نمایشگاه">${thumbs.join('')}</div>` : ''}
      </figure>
      <div class="exhibition-info">
        <p class="card-meta">
          ${typeLabel ? `<span class="badge badge--secondary">${escapeHtml(typeLabel)}</span>` : ''}
          ${exhibition.year ? `<span class="badge badge--outline">${escapeHtml(toPersianDigits(exhibition.year))}</span>` : ''}
        </p>
        <h1 class="display-2">${escapeHtml(exhibition.title)}</h1>
        ${meta.length ? `<dl class="detail-meta">${meta.map(([label, value]) => `<div class="detail-meta-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
        ${paragraphs.length ? `<div class="detail-description">${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>` : ''}
        <div class="detail-actions">
          <a class="btn btn-secondary" href="exhibitions.html">بازگشت به نمایشگاه‌ها</a>
        </div>
      </div>
    </div>`;
}

function artworkTile(art) {
  return `
    <article class="card art-card">
      <a class="card-media card-media--portrait" href="work.html?id=${encodeURIComponent(art.id)}">
        <img src="${artImageOf(art)}" alt="${escapeHtml(art.title || 'اثر')}" loading="lazy">
      </a>
      <div class="card-body">
        <p class="card-meta">
          ${art.category ? `<span class="badge badge--secondary">${escapeHtml(ART_CATEGORY_LABELS[art.category] || art.category)}</span>` : ''}
          ${art.year ? `<span>${escapeHtml(toPersianDigits(art.year))}</span>` : ''}
        </p>
        <h3 class="card-title"><a href="work.html?id=${encodeURIComponent(art.id)}">${escapeHtml(art.title)}</a></h3>
      </div>
    </article>`;
}

export function exhibitionArtworksHtml(artworks) {
  const list = (artworks || []).filter((a) => a && a.id);
  if (!list.length) return '';
  return `
    <section class="related-section" aria-labelledby="exhibition-artworks-title">
      <h2 class="section-title" id="exhibition-artworks-title">آثار این نمایشگاه</h2>
      <div class="card-grid">${list.map(artworkTile).join('')}</div>
    </section>`;
}

export function applyExhibitionSeo(exhibition, image) {
  const place = [exhibition.location, exhibition.country].filter(Boolean).join('، ');
  setSeo({
    title: `${exhibition.title} — نمایشگاه | معصومه (عارفه) پیمان`,
    description: (exhibition.description || exhibition.title || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    image,
    url: location.href,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ExhibitionEvent',
      name: exhibition.title,
      organizer: { '@type': 'Organization', name: exhibition.organizer || 'معصومه (عارفه) پیمان' },
      ...(exhibition.year ? { startDate: String(exhibition.year) } : {}),
      ...(place ? { location: { '@type': 'Place', name: place } } : {}),
      image
    }
  });
}

function notFoundHtml() {
  return `
    <div class="empty-state">
      <h3 class="empty-title">نمایشگاه یافت نشد</h3>
      <p class="empty-text">این نمایشگاه در دسترس نیست یا هنوز منتشر نشده است.</p>
      <a class="btn btn-primary" href="exhibitions.html">بازگشت به نمایشگاه‌ها</a>
    </div>`;
}

async function fetchArtworks(title, client) {
  try {
    const { data } = await client
      .from(dbTable('artworks'))
      .select('*')
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false })
      .limit(100);
    const needle = String(title || '').trim().toLowerCase();
    const list = (data || []).filter((a) => needle && String(a.exhibition || '').trim().toLowerCase() === needle);
    return list.slice(0, 6);
  } catch (error) {
    return [];
  }
}

async function loadExhibition() {
  const id = new URLSearchParams(location.search).get('id');
  const body = document.getElementById('exhibition-detail-body');
  if (!body) return;

  if (!id) {
    body.innerHTML = notFoundHtml();
    return;
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    body.innerHTML = '<p class="section-empty">پایگاه داده هنوز راه‌اندازی نشده است.</p>';
    return;
  }

  let exhibition = null;
  try {
    const { data } = await client
      .from(dbTable('exhibitions'))
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();
    exhibition = data;
  } catch (error) {
    exhibition = null;
  }

  if (!exhibition) {
    body.innerHTML = notFoundHtml();
    return;
  }

  const image = imageOf(exhibition);
  body.innerHTML = detailHtml(exhibition);
  applyExhibitionSeo(exhibition, image);

  const main = document.getElementById('exMain');
  document.querySelectorAll('#exhibition-detail-body .work-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      if (main) main.src = thumb.dataset.src;
      document.querySelectorAll('#exhibition-detail-body .work-thumb').forEach((t) => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });

  const artworksBox = document.getElementById('exhibition-artworks');
  if (artworksBox) {
    const artworks = await fetchArtworks(exhibition.title, client);
    artworksBox.innerHTML = exhibitionArtworksHtml(artworks);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadExhibition);
}