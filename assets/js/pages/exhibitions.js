import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, placeholderImage } from '../utils.js';

const PAGE_SIZE = 9;

const TYPE_LABELS = {
  solo: 'انفرادی',
  group: 'گروهی',
  joint: 'مشترک',
  online: 'آنلاین',
  other: 'سایر'
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

function buildHref(overrides) {
  const next = new URLSearchParams();
  next.set('q', (overrides.q ?? params().get('q')) || '');
  next.set('type', (overrides.type ?? params().get('type')) || '');
  next.set('page', String(overrides.page ?? (params().get('page') || 1)));
  return `exhibitions.html?${next.toString()}`;
}

function imageOf(exhibition) {
  if (exhibition.image) return publicUrl(exhibition.image);
  if (exhibition.image_url) return exhibition.image_url;
  return placeholderImage(exhibition.title || 'نمایشگاه', { variant: 'art', width: 640, height: 420 });
}

export function exhibitionCard(exhibition) {
  const place = [exhibition.location, exhibition.country].filter(Boolean).join('، ');
  const typeLabel = TYPE_LABELS[exhibition.type] || exhibition.type || '';
  return `
    <article class="card exhibition-card">
      <a class="card-media card-media--wide" href="exhibition.html?id=${encodeURIComponent(exhibition.id)}">
        <img src="${imageOf(exhibition)}" alt="نمایشگاه: ${escapeHtml(exhibition.title || 'بدون عنوان')}" loading="lazy">
      </a>
      <div class="card-body">
        <p class="card-meta">
          ${typeLabel ? `<span class="badge badge--secondary">${escapeHtml(typeLabel)}</span>` : ''}
          ${exhibition.year ? `<span>${escapeHtml(toPersianDigits(exhibition.year))}</span>` : ''}
          ${place ? `<span>${escapeHtml(place)}</span>` : ''}
        </p>
        <h3 class="card-title"><a href="exhibition.html?id=${encodeURIComponent(exhibition.id)}">${escapeHtml(exhibition.title)}</a></h3>
        ${exhibition.description ? `<p class="card-text">${escapeHtml(exhibition.description.length > 120 ? exhibition.description.slice(0, 120) + '…' : exhibition.description)}</p>` : ''}
      </div>
    </article>`;
}

function placeholder(rows) {
  if (!rows.length) {
    return '<p class="section-empty">هیچ نمایشگاهی ثبت نشده است.</p>';
  }
  return rows.map(exhibitionCard).join('');
}

function paginationHtml(totalPages, current) {
  if (totalPages <= 1) return '';
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    pages.push(`<a class="btn btn-sm pagination-link ${p === current ? 'pagination-link--active' : ''}" href="${buildHref({ page: p })}" aria-label="صفحه ${toPersianDigits(p)}" ${p === current ? 'aria-current="page"' : ''}>${toPersianDigits(p)}</a>`);
  }
  return `
    ${current > 1 ? `<a class="btn btn-sm pagination-link" href="${buildHref({ page: current - 1 })}">قبلی</a>` : ''}
    ${pages.join('')}
    ${current < totalPages ? `<a class="btn btn-sm pagination-link" href="${buildHref({ page: current + 1 })}">بعدی</a>` : ''}`;
}

async function loadExhibitions() {
  const q = (params().get('q') || '').trim();
  const type = params().get('type') || '';
  const page = Math.max(1, parseInt(params().get('page') || '1', 10) || 1);

  const searchForm = el('exhibitions-search');
  if (searchForm) {
    const fQ = searchForm.querySelector('#fQ');
    const fType = searchForm.querySelector('#fType');
    if (fQ) fQ.value = q;
    if (fType) fType.value = type;
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('exhibitions-grid', '<p class="section-empty">پایگاه داده هنوز راه‌اندازی نشده است.</p>');
    return;
  }

  let rows = [];
  let total = 0;
  try {
    const base = client.from(dbTable('exhibitions')).select('*').eq('is_published', true);
    let filtered = base;
    if (q) filtered = filtered.ilike('title', `%${q}%`);
    if (type) filtered = filtered.eq('type', type);
    const countQuery = filtered.count('exact', { head: true });
    const countResult = await countQuery;
    total = countResult.count ?? 0;

    filtered = filtered
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data } = await filtered;
    rows = data || [];
  } catch (error) {
    setHtml('exhibitions-grid', '<p class="section-empty">خطایی در دریافت نمایشگاه‌ها رخ داد.</p>');
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) {
    location.href = buildHref({ page: safePage });
    return;
  }

  setHtml('exhibitions-grid', placeholder(rows));
  setHtml('exhibitions-pagination', paginationHtml(totalPages, page));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadExhibitions();
    const form = el('exhibitions-search');
    if (form) form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const next = new URLSearchParams();
      next.set('q', String(fd.get('q') || '').trim());
      next.set('type', String(fd.get('type') || ''));
      next.set('page', '1');
      location.href = `exhibitions.html?${next.toString()}`;
    });
  });
}