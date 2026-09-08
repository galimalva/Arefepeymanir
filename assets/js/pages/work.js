import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, placeholderImage, setSeo } from '../utils.js';
import { commentsSectionHtml, initCommentsSection, fetchApprovedComments } from '../comments.js';

const CATEGORY_LABELS = {
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

const SALE_LABELS = {
  for_sale: 'برای فروش',
  sold: 'فروخته شده',
  reserved: 'رزرو شده',
  not_for_sale: 'در معرض فروش نیست'
};

const DETAIL_LABELS = {
  year: 'سال',
  technique: 'تکنیک',
  dimensions: 'ابعاد',
  exhibition: 'نمایشگاه'
};

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function params() {
  return new URLSearchParams(location.search);
}

export function saleBadgeClass(status) {
  const classes = {
    for_sale: 'badge--success',
    sold: 'badge',
    reserved: 'badge--warning',
    not_for_sale: 'badge--outline'
  };
  return classes[status] || 'badge--outline';
}

export function formatToman(price) {
  if (price === null || price === undefined || price === '') return '';
  const value = Number(price);
  if (!Number.isFinite(value)) return '';
  return `${toPersianDigits(value.toLocaleString('en-US'))} تومان`;
}

export function mainImageOf(work) {
  if (work.image) return publicUrl(work.image);
  if (work.image_url) return work.image_url;
  return placeholderImage(work.title || 'اثر', { variant: 'art', width: 800, height: 1000 });
}

function relatedTile(art) {
  const image = mainImageOf(art);
  return `
    <article class="card art-card">
      <a class="card-media card-media--portrait" href="work.html?id=${encodeURIComponent(art.id)}">
        <img src="${image}" alt="${escapeHtml(art.title || 'اثر')}" loading="lazy">
      </a>
      <div class="card-body">
        <p class="card-meta">
          ${art.category ? `<span class="badge badge--secondary">${escapeHtml(CATEGORY_LABELS[art.category] || art.category)}</span>` : ''}
          ${art.year ? `<span>${escapeHtml(toPersianDigits(art.year))}</span>` : ''}
        </p>
        <h3 class="card-title"><a href="work.html?id=${encodeURIComponent(art.id)}">${escapeHtml(art.title)}</a></h3>
      </div>
    </article>`;
}

export function relatedArtworksHtml(rows, currentId) {
  const list = (rows || []).filter((r) => r && r.id !== currentId);
  if (!list.length) return '';
  return `
    <section class="related-section" aria-labelledby="related-artworks-title">
      <h2 class="section-title" id="related-artworks-title">آثار مرتبط</h2>
      <div class="card-grid">${list.map(relatedTile).join('')}</div>
    </section>`;
}

export function applyArtworkSeo(row, image) {
  setSeo({
    title: `${row.title || 'اثر'} — معصومه (عارفه) پیمان`,
    description: (row.description || row.title || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    image,
    url: location.href,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VisualArtwork',
      name: row.title,
      creator: { '@type': 'Person', name: 'معصومه (عارفه) پیمان' },
      ...(row.technique ? { artMedium: row.technique } : {}),
      ...(row.dimensions ? { size: row.dimensions } : {}),
      ...(row.category ? { artform: CATEGORY_LABELS[row.category] || row.category } : {}),
      ...(row.year ? { dateCreated: String(row.year) } : {}),
      image
    }
  });
}

async function fetchRelatedArtworks(row, client) {
  let query = client
    .from(dbTable('artworks'))
    .select('*')
    .eq('is_published', true)
    .neq('id', row.id);
  if (row.collection) query = query.eq('collection', row.collection);
  else if (row.category) query = query.eq('category', row.category);
  query = query
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(4);
  try {
    const { data } = await query;
    return data || [];
  } catch (error) {
    return [];
  }
}

function fillDetail(row) {
  const image = mainImageOf(row);
  const badges = [];
  if (row.category) badges.push(`<span class="badge badge--secondary">${escapeHtml(CATEGORY_LABELS[row.category] || row.category)}</span>`);
  if (row.collection) badges.push(`<span class="badge badge--outline">مجموعه: ${escapeHtml(row.collection)}</span>`);

  const metaItems = ['year', 'technique', 'dimensions', 'exhibition']
    .filter((key) => row[key] !== null && row[key] !== undefined && row[key] !== '')
    .map(
      (key) => {
        const value = key === 'year' ? toPersianDigits(row[key]) : String(row[key]).trim();
        return `
        <div class="work-meta-item">
          <dt>${escapeHtml(DETAIL_LABELS[key])}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`;
      }
    )
    .join('');

  const thumbs = [row.image, ...(Array.isArray(row.images) ? row.images : [])]
    .filter(Boolean)
    .map((path, i) => {
      const src = publicUrl(path);
      return `<button class="work-thumb${i === 0 ? ' is-active' : ''}" type="button" data-src="${escapeHtml(src)}" aria-label="نمایش تصویر ${toPersianDigits(i + 1)}"><img src="${escapeHtml(src)}" alt="" loading="lazy"></button>`;
    });

  const hasPrice = row.price !== null && row.price !== undefined && row.price !== '';
  const priceBlock =
    hasPrice || row.sale_status || row.purchase_note
      ? `
        <aside class="price-card">
          <div class="price-card-row">
            ${row.sale_status ? `<span class="badge ${saleBadgeClass(row.sale_status)}">${escapeHtml(SALE_LABELS[row.sale_status] || row.sale_status)}</span>` : ''}
            ${hasPrice ? `<strong class="price-amount">${formatToman(row.price)}</strong>` : ''}
          </div>
          ${row.purchase_note ? `<p class="price-note">${escapeHtml(row.purchase_note)}</p>` : ''}
        </aside>`
      : '';

  return `
    <nav class="breadcrumb" aria-label="مسیر">
      <a href="gallery.html">گالری</a>
      <span aria-hidden="true">/</span>
      <span>${escapeHtml(row.title || 'اثر')}</span>
    </nav>

    <div class="work-detail-grid">
      <figure class="work-media">
        <img id="wdMain" class="work-main-img" src="${image}" alt="${escapeHtml(row.title || 'اثر')}" fetchpriority="high">
        ${thumbs.length > 1 ? `<div class="work-thumbs" aria-label="تصاویر اثر">${thumbs.join('')}</div>` : ''}
      </figure>

      <aside class="work-info">
        <h1 class="work-title">${escapeHtml(row.title || 'اثر بی‌عنوان')}</h1>
        ${badges.length ? `<div class="work-badges">${badges.join(' ')}</div>` : ''}
        <dl class="work-meta-grid">${metaItems}</dl>
        ${row.description ? `<p class="work-description">${escapeHtml(row.description)}</p>` : ''}
        ${priceBlock}
        <div class="work-actions">
          <a class="btn btn-secondary" href="gallery.html">بازگشت به گالری</a>
        </div>
      </aside>
    </div>`;
}

function notFound(message) {
  setHtml(
    'work-detail',
    `<div class="empty-state">
      <h3 class="empty-title">اثر یافت نشد</h3>
      <p class="empty-text">${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="gallery.html">بازگشت به گالری</a>
    </div>`
  );
}

async function loadWork() {
  const id = params().get('id');
  if (!id) {
    notFound('این صفحه بدون شناسهٔ اثر باز شده است.');
    return;
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml(
      'work-detail',
      `<div class="empty-state">
        <h3 class="empty-title">این بخش به‌زودی تکمیل می‌شود</h3>
        <p class="empty-text">پس از راه‌اندازی پایگاه داده، جزئیات اثر اینجا نمایش داده می‌شود.</p>
      </div>`
    );
    return;
  }

  let row = null;
  try {
    const { data } = await client
      .from(dbTable('artworks'))
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();
    row = data;
  } catch (error) {
    notFound('خطایی در دریافت اثر رخ داد؛ لطفاً دوباره تلاش کنید.');
    return;
  }

  if (!row) {
    notFound('اثر موردنظر منتشر نشده یا وجود ندارد.');
    return;
  }

  setHtml('work-detail', fillDetail(row));

  const main = document.getElementById('wdMain');
  document.querySelectorAll('#work-detail .work-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      if (main) main.src = thumb.dataset.src;
      document.querySelectorAll('#work-detail .work-thumb').forEach((t) => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });

  async function fetchWorkComments(client, itemId) {
    try {
      const { data } = await fetchApprovedComments(client, 'artwork', 'artwork_id', itemId);
      return data || [];
    } catch (error) {
      return [];
    }
  }

  const commentsBox = document.getElementById('work-comments');
  if (commentsBox) {
    const comments = await fetchWorkComments(client, row.id);
    commentsBox.innerHTML = commentsSectionHtml(comments);
    initCommentsSection({
      root: commentsBox,
      itemType: 'artwork',
      idField: 'artwork_id',
      itemId: row.id,
      fetchComments: () => fetchWorkComments(client, row.id).then((rows) => ({ data: rows }))
    });
  }

  const relatedBox = document.getElementById('work-related');
  if (relatedBox) {
    const related = await fetchRelatedArtworks(row, client);
    relatedBox.innerHTML = relatedArtworksHtml(related, row.id);
  }
  applyArtworkSeo(row, mainImageOf(row));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadWork);
}